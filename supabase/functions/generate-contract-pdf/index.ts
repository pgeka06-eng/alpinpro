import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "contractId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: contract, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (error || !contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch linked estimate if exists
    let estimate = null;
    if (contract.estimate_id) {
      const { data } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", contract.estimate_id)
        .single();
      estimate = data;
    }

    const isAct = contract.type === "act";
    const title = isAct
      ? `АКТ ВЫПОЛНЕННЫХ РАБОТ №${contract.number}`
      : `ДОГОВОР №${contract.number}`;
    const dateStr = new Date(contract.created_at).toLocaleDateString("ru-RU");

    // Generate simple HTML-based PDF content
    const html = generateHtml(contract, estimate, title, dateStr, isAct);

    // Store as HTML file (can be converted/printed as PDF by client)
    const fileName = `${contract.type}_${contract.number}_${Date.now()}.html`;
    const filePath = `${contract.user_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(filePath, new Blob([html], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrl } = supabase.storage
      .from("contracts")
      .getPublicUrl(filePath);

    await supabase
      .from("contracts")
      .update({ pdf_path: filePath })
      .eq("id", contractId);

    return new Response(
      JSON.stringify({ url: publicUrl.publicUrl, path: filePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateHtml(
  contract: any,
  estimate: any,
  title: string,
  dateStr: string,
  isAct: boolean
): string {
  const serviceName = estimate?.service_name || contract.description || "Высотные работы";
  const volume = estimate?.volume || "";
  const unit = estimate?.unit || "";
  const totalPrice = Number(contract.total_price).toLocaleString("ru-RU");

  const signatureBlock = contract.signed_at
    ? `<div style="margin-top:30px;padding:15px;border:2px solid #22c55e;border-radius:8px;background:#f0fdf4">
        <strong>✅ Подписано электронно</strong><br/>
        Дата: ${new Date(contract.signed_at).toLocaleString("ru-RU")}<br/>
        IP: ${contract.signed_ip || "—"}<br/>
        Устройство: ${contract.signed_device || "—"}
       </div>`
    : `<div style="margin-top:40px">
        <table style="width:100%"><tr>
          <td style="width:50%;border-top:1px solid #000;padding-top:5px">Исполнитель: _______________</td>
          <td style="width:50%;border-top:1px solid #000;padding-top:5px">Заказчик: _______________</td>
        </tr></table>
       </div>`;

  if (isAct) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:18px;margin-bottom:5px}
.date{text-align:center;color:#666;margin-bottom:30px}
table.items{width:100%;border-collapse:collapse;margin:20px 0}
table.items th,table.items td{border:1px solid #ccc;padding:8px 12px;text-align:left}
table.items th{background:#f5f5f5}
.total{text-align:right;font-size:18px;font-weight:bold;margin:20px 0}
@media print{body{margin:0;padding:20px}}
</style></head><body>
<h1>${title}</h1>
<p class="date">от ${dateStr}</p>
<p>Заказчик: <strong>${contract.client_name}</strong></p>
<p>Настоящим актом подтверждается, что нижеперечисленные работы выполнены в полном объёме и в надлежащем качестве.</p>
<table class="items">
<tr><th>№</th><th>Наименование работ</th><th>Объём</th><th>Ед.</th><th>Сумма, ₽</th></tr>
<tr><td>1</td><td>${serviceName}</td><td>${volume}</td><td>${unit}</td><td>${totalPrice}</td></tr>
</table>
<p class="total">Итого: ${totalPrice} ₽</p>
<p>Стороны претензий по объёму, качеству и срокам выполненных работ не имеют.</p>
${signatureBlock}
</body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:18px;margin-bottom:5px}
.date{text-align:center;color:#666;margin-bottom:30px}
h2{font-size:14px;margin-top:25px;color:#333}
.total{font-size:18px;font-weight:bold;margin:20px 0;text-align:right}
@media print{body{margin:0;padding:20px}}
</style></head><body>
<h1>${title}</h1>
<p class="date">от ${dateStr}</p>

<h2>1. СТОРОНЫ</h2>
<p><strong>Исполнитель:</strong> ИП / ООО (данные компании)</p>
<p><strong>Заказчик:</strong> ${contract.client_name}${contract.client_phone ? `, тел: ${contract.client_phone}` : ""}${contract.client_email ? `, email: ${contract.client_email}` : ""}</p>

<h2>2. ПРЕДМЕТ ДОГОВОРА</h2>
<p>Исполнитель обязуется выполнить следующие работы: <strong>${serviceName}</strong>${volume ? ` в объёме ${volume} ${unit}` : ""}.</p>

<h2>3. СТОИМОСТЬ РАБОТ</h2>
<p class="total">Итого: ${totalPrice} ₽</p>
${estimate ? `<p style="color:#666;font-size:13px">Коэффициенты: срочность ×${estimate.coeff_urgency}, сложность ×${estimate.coeff_complexity}, высота ×${estimate.coeff_height}, сезон ×${estimate.coeff_season}</p>` : ""}

<h2>4. СРОКИ</h2>
<p>Сроки выполнения работ определяются по согласованию сторон.</p>

<h2>5. ПОРЯДОК ОПЛАТЫ</h2>
<p>Оплата производится в порядке, согласованном сторонами.</p>

<h2>6. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
<p>Стороны несут ответственность в соответствии с действующим законодательством РФ.</p>

${signatureBlock}
</body></html>`;
}
