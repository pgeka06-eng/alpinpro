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

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { priceListId, fileContent } = await req.json();

    if (!priceListId || !fileContent) {
      return new Response(JSON.stringify({ error: 'Missing priceListId or fileContent' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to parsing
    await supabase.from('price_lists').update({ status: 'parsing' }).eq('id', priceListId);

    // Use AI to parse the text content
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Ты парсер прайс-листов для промышленных альпинистов. Извлеки из текста список услуг.
Верни ТОЛЬКО JSON массив объектов с полями:
- service_name: название услуги (строка)
- unit: единица измерения (м², п.м., шт, м.п., и т.д.)
- price: цена за единицу (число)
- description: краткое описание если есть (строка или null)

Если не можешь разобрать цену — ставь 0. Если не можешь определить единицу — ставь "шт".
Верни ТОЛЬКО валидный JSON массив, без markdown, без пояснений.`,
          },
          {
            role: 'user',
            content: `Распознай услуги из этого прайс-листа:\n\n${fileContent}`,
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
    const content = aiData.choices?.[0]?.message?.content || '[]';

    let items: any[];
    try {
      const parsed = JSON.parse(content);
      items = Array.isArray(parsed) ? parsed : parsed.items || parsed.services || Object.values(parsed)[0] || [];
    } catch {
      console.error('Failed to parse AI response:', content);
      await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert parsed items
    if (items.length > 0) {
      const insertData = items.map((item: any, index: number) => ({
        price_list_id: priceListId,
        service_name: String(item.service_name || item.name || 'Неизвестная услуга'),
        unit: String(item.unit || 'шт'),
        price: Number(item.price) || 0,
        description: item.description || null,
        sort_order: index,
        is_verified: false,
      }));

      const { error: insertError } = await supabase.from('price_items').insert(insertData);
      if (insertError) {
        console.error('Insert error:', insertError);
        await supabase.from('price_lists').update({ status: 'error' }).eq('id', priceListId);
        return new Response(JSON.stringify({ error: 'Failed to save items' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update status
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
