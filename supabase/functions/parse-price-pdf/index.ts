import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let priceListId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey || !lovableApiKey) {
      throw new Error("Missing server configuration for PDF parsing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      priceListId: requestPriceListId,
      fileBase64,
      filePath,
    } = await req.json();

    priceListId = requestPriceListId ?? null;

    if (!priceListId || (!fileBase64 && !filePath)) {
      return new Response(JSON.stringify({ error: "Missing priceListId and file source" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("price_lists").update({ status: "parsing" }).eq("id", priceListId);

    let resolvedBase64 = fileBase64 as string | undefined;

    if (!resolvedBase64 && filePath) {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("price-pdfs")
        .download(filePath);

      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || "Failed to download PDF from storage");
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      resolvedBase64 = arrayBufferToBase64(arrayBuffer);
    }

    if (!resolvedBase64) {
      throw new Error("PDF data is empty");
    }

    const systemPrompt = `Ты — высокоточный парсер прайс-листов для компаний промышленного альпинизма и высотных работ.

Твоя задача: извлечь АБСОЛЮТНО ВСЕ строки с услугами, ценами, коэффициентами и привязкой к городам из PDF документа.

Верни JSON объект с полем "items" — массив объектов со следующими полями:
- service_name (string): полное название услуги. Если услуга вложена в раздел/категорию, добавь название раздела в начало через " — ".
- unit (string): единица измерения. Если не указана — "шт".
- price (number): цена за единицу. Если диапазон "от X до Y" — бери среднее. Если "от X" — бери X. Если "договорная" или не указана — 0.
- description (string|null): раздел, примечания, условия, особенности, а также город при наличии.
- coefficient (number|null): коэффициент/множитель. Ищи в отдельных колонках, примечаниях, процентах, формулах вида к=1.2, x1.5, ×2.
- city (string|null): город/регион, если услуги или цены относятся к конкретному городу.

КРИТИЧЕСКИ ВАЖНО:
1. Извлекай ВСЕ строки таблиц без исключения.
2. Каждая строка таблицы с услугой = отдельный объект.
3. Если в документе несколько таблиц, страниц, разделов или городов — извлеки всё.
4. Если одна услуга имеет отдельные цены по городам, создай отдельные записи для каждого города.
5. Если PDF сканированный, всё равно распознай текст.
6. Верни ТОЛЬКО валидный JSON с полем "items".`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${resolvedBase64}` },
              },
              {
                type: "text",
                text: "Распознай все услуги, цены, коэффициенты и города. Не пропускай строки. Если города разные — создай отдельные записи.",
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const status = aiResponse.status === 402 || aiResponse.status === 429 ? aiResponse.status : 500;
      await supabase.from("price_lists").update({ status: "error" }).eq("id", priceListId);
      return new Response(JSON.stringify({ error: "AI parsing failed", details: errText }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let items: any[] = [];
    try {
      const parsed = JSON.parse(content);
      items = Array.isArray(parsed)
        ? parsed
        : parsed.items || parsed.services || parsed.data || parsed.rows || parsed.result || [];

      if (!Array.isArray(items)) {
        const firstArr = Object.values(parsed).find((value) => Array.isArray(value));
        items = (firstArr as any[]) || [];
      }
    } catch {
      await supabase.from("price_lists").update({ status: "error" }).eq("id", priceListId);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertData = items
      .map((item: any, index: number) => {
        const city = item.city ? String(item.city).trim() : "";
        const baseName = String(item.service_name || item.name || item.title || "").trim();
        const serviceName = baseName || "Неизвестная услуга";
        const prefixedName = city && !serviceName.toLowerCase().includes(city.toLowerCase())
          ? `${city} — ${serviceName}`
          : serviceName;

        const descParts: string[] = [];
        if (city) descParts.push(`Город: ${city}`);
        if (item.description) descParts.push(String(item.description).trim());

        const coefficient = item.coefficient != null ? Number(item.coefficient) : null;
        if (coefficient != null && Number.isFinite(coefficient) && coefficient !== 0 && coefficient !== 1) {
          descParts.push(`Коэффициент: ${coefficient}`);
        }

        let price = Number(item.price);
        if (!Number.isFinite(price) || Math.abs(price) > 99999999) price = 0;
        price = Math.round(price * 100) / 100;

        return {
          price_list_id: priceListId,
          service_name: prefixedName.substring(0, 500),
          unit: String(item.unit || "шт").trim().substring(0, 50) || "шт",
          price,
          description: descParts.length ? descParts.join("; ").substring(0, 1000) : null,
          sort_order: index,
          is_verified: false,
        };
      })
      .filter((item) => item.service_name.trim().length > 0);

    if (insertData.length === 0) {
      await supabase.from("price_lists").update({ status: "error" }).eq("id", priceListId);
      return new Response(JSON.stringify({ error: "Не удалось распознать услуги из PDF" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let i = 0; i < insertData.length; i += 100) {
      const batch = insertData.slice(i, i + 100);
      const { error: insertError } = await supabase.from("price_items").insert(batch);
      if (insertError) {
        await supabase.from("price_lists").update({ status: "error" }).eq("id", priceListId);
        return new Response(JSON.stringify({ error: "Failed to save items", details: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("price_lists").update({ status: "parsed" }).eq("id", priceListId);

    return new Response(JSON.stringify({ success: true, itemCount: insertData.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (priceListId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          await supabase.from("price_lists").update({ status: "error" }).eq("id", priceListId);
        }
      } catch {
        // ignore secondary error
      }
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});