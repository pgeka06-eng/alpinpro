import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { priceListId, fileBase64 } = await req.json();

    if (!priceListId || !fileBase64) {
      return new Response(JSON.stringify({ error: 'Missing priceListId or fileBase64' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('price_lists').update({ status: 'parsing' }).eq('id', priceListId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Ты — высокоточный парсер прайс-листов для компаний промышленного альпинизма и высотных работ.

Твоя задача: извлечь АБСОЛЮТНО ВСЕ строки с услугами, ценами и коэффициентами из PDF документа.

Верни JSON объект с полем "items" — массив объектов со следующими полями:
- service_name (string): ПОЛНОЕ название услуги. Если услуга вложена в раздел/категорию, добавь название раздела в начало через " — " (например "Фасадные работы — Мойка окон")
- unit (string): единица измерения. Стандартные: м², п.м., шт, м.п., кв.м, куб.м, компл, усл, час, смена, объект, выезд, м, кг, т, л. Если не указана — "шт"
- price (number): цена за единицу. Если диапазон "от X до Y" — бери среднее. Если "от X" — бери X. Если "договорная" или не указана — 0
- description (string|null): доп. информация: раздел/категория, примечания, условия, минимальный объём, особенности
- coefficient (number|null): коэффициент/множитель. Ищи в:
  • Отдельных колонках таблицы (к, коэф., К)
  • В тексте рядом с ценой: "к=1.5", "x1.5", "×2"  
  • В примечаниях: "повышающий коэффициент 1.2"
  • Надбавки в %: "+20% высотность" → 1.2, "+50% срочность" → 1.5
  • Понижающие: "-10%" → 0.9

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. Извлекай ВСЕ строки без исключения, даже если их сотни. Не группируй, не обобщай, не пропускай.
2. Каждая строка таблицы с названием услуги = отдельный объект в массиве.
3. Если в PDF несколько таблиц или разделов — извлеки из ВСЕХ.
4. Разделы и подразделы (Фасадные работы, Кровельные работы, Герметизация и т.д.) — НЕ создавай для них отдельные записи, но используй их как префикс для service_name вложенных услуг.
5. Если есть примечания к услуге (сноски, звёздочки) — включи их в description.
6. Числа: убирай пробелы-разделители тысяч (1 500 → 1500), запятые заменяй на точки.
7. Если одна услуга имеет несколько вариантов цен (например по высоте: до 30м — 500, до 50м — 700) — создай ОТДЕЛЬНЫЕ записи для каждого варианта.

Верни ТОЛЬКО валидный JSON с полем "items". Никакого текста до или после JSON.`;

    const aiResponse = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${fileBase64}` },
              },
              {
                type: 'text',
                text: 'Распознай ВСЕ услуги, цены, единицы измерения и коэффициенты из этого прайс-листа. Не пропусти ни одной строки. Каждую строку таблицы — в отдельный элемент массива.',
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI API error:', errText);
      await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
      return new Response(JSON.stringify({ error: 'AI parsing failed', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';

    let items: any[];
    try {
      const parsed = JSON.parse(content);
      // Try multiple possible field names
      items = Array.isArray(parsed) ? parsed
        : parsed.items || parsed.services || parsed.data || parsed.rows || parsed.result || [];
      if (!Array.isArray(items)) {
        // Last resort: find first array value in the object
        const firstArr = Object.values(parsed).find(v => Array.isArray(v));
        items = (firstArr as any[]) || [];
      }
    } catch {
      console.error('Failed to parse AI response:', content);
      await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (items.length > 0) {
      const insertData = items.map((item: any, index: number) => {
        let desc = item.description || null;
        const coeff = item.coefficient != null ? Number(item.coefficient) : null;
        if (coeff != null && coeff !== 1 && coeff !== 0) {
          const coeffStr = `Коэффициент: ${coeff}`;
          desc = desc ? `${desc}; ${coeffStr}` : coeffStr;
        }

        let price = Number(item.price) || 0;
        if (price > 99999999) price = 0;
        price = Math.round(price * 100) / 100;

        return {
          price_list_id: priceListId,
          service_name: String(item.service_name || item.name || item.title || 'Неизвестная услуга').substring(0, 500),
          unit: String(item.unit || 'шт').substring(0, 50),
          price,
          description: desc ? String(desc).substring(0, 1000) : null,
          sort_order: index,
          is_verified: false,
        };
      });

      // Insert in batches of 100 to avoid payload limits
      for (let i = 0; i < insertData.length; i += 100) {
        const batch = insertData.slice(i, i + 100);
        const { error: insertError } = await supabase.from('price_items').insert(batch);
        if (insertError) {
          console.error('Insert error batch', i, insertError);
          await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
          return new Response(JSON.stringify({ error: 'Failed to save items', details: insertError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    await supabase.from('price_lists').update({ status: 'parsed' }).eq('id', priceListId);

    return new Response(JSON.stringify({ success: true, itemCount: items.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
