import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const body = await req.json();
    const {
      executor_company,
      executor_name,
      executor_position,
      executor_inn,
      executor_kpp,
      executor_address,
      executor_bank,
      executor_account,
      executor_bik,
      executor_corr_account,
      client_company,
      client_name,
      client_position,
      client_inn,
      client_kpp,
      client_address,
      client_bank,
      client_account,
      client_bik,
      client_corr_account,
      service_type,
      service_description,
      work_address,
      volume,
      unit,
      price_per_unit,
      total_price,
      deadline,
      city,
      contract_date,
      payment_method,
      additional_conditions,
    } = body;

    if (!executor_company || !client_company || !service_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields: executor_company, client_company, service_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Составь полный текст договора подряда на проведение высотных работ в формате HTML.
Используй следующий шаблон структуры:

1. ПРЕАМБУЛА с городом, датой, данными сторон
2. ПРЕДМЕТ ДОГОВОРА — конкретный перечень работ, адрес, сроки
3. ЦЕНА КОНТРАКТА — стоимость, порядок оплаты
4. ПРАВА И ОБЯЗАННОСТИ СТОРОН
5. ПОРЯДОК СДАЧИ-ПРИЁМКИ РАБОТ
6. ОТВЕТСТВЕННОСТЬ СТОРОН
7. ФОРС-МАЖОР
8. СРОК ДЕЙСТВИЯ И РАСТОРЖЕНИЕ
9. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН

Данные для заполнения:

ИСПОЛНИТЕЛЬ:
- Компания: ${executor_company}
- Представитель: ${executor_name || '_______________'}
- Должность: ${executor_position || 'Директор'}
- ИНН: ${executor_inn || '_______________'}
- КПП: ${executor_kpp || '_______________'}
- Юр. адрес: ${executor_address || '_______________'}
- Банк: ${executor_bank || '_______________'}
- Р/с: ${executor_account || '_______________'}
- БИК: ${executor_bik || '_______________'}
- К/с: ${executor_corr_account || '_______________'}

ЗАКАЗЧИК:
- Компания: ${client_company}
- Представитель: ${client_name || '_______________'}
- Должность: ${client_position || 'Директор'}
- ИНН: ${client_inn || '_______________'}
- КПП: ${client_kpp || '_______________'}
- Юр. адрес: ${client_address || '_______________'}
- Банк: ${client_bank || '_______________'}
- Р/с: ${client_account || '_______________'}
- БИК: ${client_bik || '_______________'}
- К/с: ${client_corr_account || '_______________'}

РАБОТЫ:
- Вид работ: ${service_type}
- Описание: ${service_description || 'Согласно приложению'}
- Адрес проведения: ${work_address || '_______________'}
- Объём: ${volume || '___'} ${unit || 'м²'}
- Цена за единицу: ${price_per_unit || '___'} руб.
- Общая стоимость: ${total_price || '___'} руб.
- Срок выполнения: ${deadline || '_______________'}

ДОПОЛНИТЕЛЬНО:
- Город: ${city || 'г. Москва'}
- Дата договора: ${contract_date || new Date().toLocaleDateString('ru-RU')}
- Способ оплаты: ${payment_method || 'безналичный расчёт'}
- Дополнительные условия: ${additional_conditions || 'нет'}

ВАЖНО:
- Верни ТОЛЬКО HTML код без markdown обёрток
- Используй профессиональный юридический язык
- Все пустые поля оставь с подчёркиваниями _______________
- Добавь нумерацию пунктов и подпунктов
- В конце добавь блок реквизитов в виде двух колонок (Исполнитель | Заказчик)
- Стили должны быть inline для печати
- Шрифт Arial, размер 14px, межстрочный интервал 1.5`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'Ты профессиональный юрист, специализирующийся на составлении договоров подряда для высотных и промышленных альпинистских работ в России. Составляй юридически грамотные документы на русском языке.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Слишком много запросов, попробуйте позже' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Необходимо пополнить баланс AI' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    let html = aiData.choices?.[0]?.message?.content || '';

    // Strip markdown code fences if present
    html = html.replace(/^```html?\s*/i, '').replace(/```\s*$/, '').trim();

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
