import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Send PDF as inline_data to Gemini which supports native PDF parsing
    const aiResponse = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Ты парсер прайс-листов для промышленных альпинистов. Извлеки ВСЕ услуги, цены и коэффициенты из PDF.

Верни JSON объект с полем "items" — массив объектов:
- service_name: полное название услуги (строка). Если услуга относится к разделу/категории, добавь её в начало через " — ".
- unit: единица измерения (м², п.м., шт, м.п., м2, кв.м, куб.м, компл, усл, час, смена, объект, выезд и т.д.)
- price: цена за единицу (число). Если указан диапазон "от X до Y", бери среднее.
- description: дополнительная информация: раздел/категория, примечания, условия применения (строка или null)
- coefficient: коэффициент/множитель если указан (число или null). Ищи: "коэф.", "к=", "x1.5", "повышающий", "понижающий", надбавки в %.

Правила:
1. Извлекай ВСЕ строки с услугами, даже если их сотни. Не пропускай ни одну.
2. Если цена не указана — ставь 0. Если единица не определена — ставь "шт".
3. Коэффициенты могут быть в отдельных колонках, в скобках рядом с ценой, или в примечаниях.
4. Если есть таблица с разделами (Фасадные работы, Кровельные работы и т.д.), сохрани название раздела в description.
5. Надбавки в процентах (высотность +20%, срочность +50%) конвертируй в коэффициент (1.2, 1.5).

Верни ТОЛЬКО валидный JSON объект с полем items.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${fileBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Распознай все услуги и цены из этого прайс-листа PDF.',
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
      items = Array.isArray(parsed) ? parsed : parsed.items || parsed.services || Object.values(parsed)[0] || [];
      if (!Array.isArray(items)) items = [];
    } catch {
      console.error('Failed to parse AI response:', content);
      await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (items.length > 0) {
      const insertData = items.map((item: any, index: number) => {
        // Convert coefficient info to description suffix
        let desc = item.description || null;
        if (item.coefficient != null && item.coefficient !== 1) {
          const coeffStr = `Коэффициент: ${item.coefficient}`;
          desc = desc ? `${desc}; ${coeffStr}` : coeffStr;
        }
        return {
          price_list_id: priceListId,
          service_name: String(item.service_name || item.name || 'Неизвестная услуга'),
          unit: String(item.unit || 'шт'),
          price: Number(item.price) || 0,
          description: desc,
          sort_order: index,
          is_verified: false,
        };
      });

      const { error: insertError } = await supabase.from('price_items').insert(insertData);
      if (insertError) {
        console.error('Insert error:', insertError);
        await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
        return new Response(JSON.stringify({ error: 'Failed to save items' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
