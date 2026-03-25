import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  FileText, Download, Eye, Calendar, Plus, Send, CheckCircle, Loader2,
  ExternalLink, ClipboardList, Receipt, BarChart3, Printer, Filter,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";
import { ru } from "date-fns/locale";

// ─── Types ────────────────────────────────────
type Contract = {
  id: string; type: string; number: string; client_name: string;
  client_email: string | null; client_phone: string | null;
  description: string | null; total_price: number; status: string;
  token: string; estimate_id: string | null; signed_at: string | null;
  signed_ip: string | null; signed_device: string | null;
  pdf_path: string | null; created_at: string;
};

type Estimate = {
  id: string; client_name: string; service_name: string; volume: number;
  unit: string; base_price: number; total_price: number; status: string;
  coeff_urgency: number; coeff_complexity: number; coeff_height: number;
  coeff_season: number; total_coeff: number; token: string; created_at: string;
};

const contractStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  sent: { label: "На подписи", variant: "outline" },
  signed: { label: "Подписан", variant: "default" },
};

const estimateStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "Ожидание", variant: "secondary" },
  viewed: { label: "Просмотрено", variant: "outline" },
  agreed: { label: "Согласовано", variant: "default" },
};

// ─── PDF Generation helpers ────────────────────
function openPrintWindow(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Разрешите всплывающие окна"); return; }
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  setTimeout(() => w.print(), 500);
}

function generateEstimatePdf(est: Estimate) {
  const date = format(parseISO(est.created_at), "dd.MM.yyyy");
  const coeffRows = [
    { name: "Срочность", val: est.coeff_urgency },
    { name: "Сложность", val: est.coeff_complexity },
    { name: "Высота", val: est.coeff_height },
    { name: "Сезон", val: est.coeff_season },
  ].filter((c) => c.val !== 1);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:20px;margin-bottom:5px}.date{text-align:center;color:#666;margin-bottom:30px}
table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px 14px;text-align:left}
th{background:#f5f5f5;font-size:13px}.total{text-align:right;font-size:20px;font-weight:bold;margin:20px 0}
.section{margin-top:25px}.label{color:#666;font-size:13px}
@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>СМЕТА</h1><p class="date">от ${date}</p>
<div class="section"><span class="label">Заказчик:</span> <strong>${est.client_name}</strong></div>
<table><tr><th>Услуга</th><th>Объём</th><th>Ед.</th><th>Цена за ед.</th><th>Сумма</th></tr>
<tr><td>${est.service_name}</td><td>${est.volume}</td><td>${est.unit}</td>
<td>${Number(est.base_price).toLocaleString("ru-RU")} ₽</td>
<td>${(est.volume * est.base_price).toLocaleString("ru-RU")} ₽</td></tr></table>
${coeffRows.length > 0 ? `<div class="section"><strong>Коэффициенты:</strong><table>
<tr><th>Параметр</th><th>Множитель</th></tr>
${coeffRows.map((c) => `<tr><td>${c.name}</td><td>×${c.val}</td></tr>`).join("")}
<tr><td><strong>Итого коэфф.</strong></td><td><strong>×${est.total_coeff}</strong></td></tr>
</table></div>` : ""}
<p class="total">Итого: ${Number(est.total_price).toLocaleString("ru-RU")} ₽</p>
</body></html>`;
}

function generateContractPdf(c: Contract) {
  const date = format(parseISO(c.created_at), "dd.MM.yyyy");
  const isAct = c.type === "act";
  const title = isAct ? `АКТ ВЫПОЛНЕННЫХ РАБОТ №${c.number}` : `ДОГОВОР №${c.number}`;
  const sig = c.signed_at
    ? `<div style="margin-top:30px;padding:15px;border:2px solid #22c55e;border-radius:8px;background:#f0fdf4">
        <strong>✅ Подписано электронно</strong><br/>Дата: ${format(parseISO(c.signed_at), "dd.MM.yyyy HH:mm")}<br/>
        IP: ${c.signed_ip || "—"}<br/>Устройство: ${c.signed_device || "—"}</div>`
    : `<div style="margin-top:50px"><table style="width:100%"><tr>
        <td style="width:50%;border-top:1px solid #000;padding-top:8px">Исполнитель: _______________</td>
        <td style="width:50%;border-top:1px solid #000;padding-top:8px">Заказчик: _______________</td></tr></table></div>`;

  if (isAct) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:18px}.date{text-align:center;color:#666;margin-bottom:25px}
table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
th{background:#f5f5f5}.total{text-align:right;font-size:18px;font-weight:bold;margin:15px 0}
@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>${title}</h1><p class="date">от ${date}</p>
<p>Заказчик: <strong>${c.client_name}</strong></p>
<p>Настоящим актом подтверждается, что работы выполнены в полном объёме и надлежащем качестве.</p>
<table><tr><th>№</th><th>Наименование работ</th><th>Сумма, ₽</th></tr>
<tr><td>1</td><td>${c.description || "Высотные работы"}</td><td>${Number(c.total_price).toLocaleString("ru-RU")}</td></tr></table>
<p class="total">Итого: ${Number(c.total_price).toLocaleString("ru-RU")} ₽</p>
<p>Стороны претензий по объёму, качеству и срокам не имеют.</p>${sig}
</body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:18px}.date{text-align:center;color:#666;margin-bottom:25px}
h2{font-size:14px;margin-top:25px;color:#333}.total{font-size:18px;font-weight:bold;margin:15px 0;text-align:right}
@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>${title}</h1><p class="date">от ${date}</p>
<h2>1. СТОРОНЫ</h2><p><strong>Заказчик:</strong> ${c.client_name}${c.client_phone ? `, тел: ${c.client_phone}` : ""}${c.client_email ? `, email: ${c.client_email}` : ""}</p>
<h2>2. ПРЕДМЕТ ДОГОВОРА</h2><p>Исполнитель обязуется выполнить: <strong>${c.description || "Высотные работы"}</strong></p>
<h2>3. СТОИМОСТЬ</h2><p class="total">${Number(c.total_price).toLocaleString("ru-RU")} ₽</p>
<h2>4. СРОКИ</h2><p>Определяются по согласованию сторон.</p>
<h2>5. ОПЛАТА</h2><p>В порядке, согласованном сторонами.</p>
<h2>6. ОТВЕТСТВЕННОСТЬ</h2><p>В соответствии с законодательством РФ.</p>${sig}
</body></html>`;
}

function generateFinancialReport(
  payments: any[], expenses: any[], orders: any[], periodLabel: string,
  totalIncome: number, totalExpenses: number, netProfit: number
) {
  const date = format(new Date(), "dd.MM.yyyy");

  const expByCategory: Record<string, number> = {};
  expenses.forEach((e: any) => { expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount); });
  const catLabels: Record<string, string> = { materials: "Материалы", transport: "Транспорт", rent: "Аренда", salary: "Зарплаты", other: "Прочее" };

  const methodLabels: Record<string, string> = { cash: "Наличные", card: "Безнал", transfer: "Перевод" };
  const incByMethod: Record<string, number> = {};
  payments.forEach((p: any) => { incByMethod[p.payment_method] = (incByMethod[p.payment_method] || 0) + Number(p.amount); });

  const paidOrders = orders.filter((o: any) => o.payment_status === "paid").length;
  const partialOrders = orders.filter((o: any) => o.payment_status === "partial").length;
  const unpaidOrders = orders.filter((o: any) => o.payment_status === "unpaid").length;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.6}
h1{text-align:center;font-size:20px;margin-bottom:5px}.date{text-align:center;color:#666;margin-bottom:30px}
h2{font-size:15px;color:#333;margin-top:30px;border-bottom:1px solid #eee;padding-bottom:5px}
table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
th{background:#f5f5f5;font-size:13px}.summary{display:flex;gap:30px;margin:20px 0}
.summary-item{flex:1;padding:15px;border:1px solid #eee;border-radius:8px;text-align:center}
.summary-item .val{font-size:22px;font-weight:bold;margin-top:5px}
.green{color:#16a34a}.red{color:#dc2626}
@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>ФИНАНСОВЫЙ ОТЧЁТ</h1><p class="date">Период: ${periodLabel} | Сформирован: ${date}</p>

<div class="summary">
<div class="summary-item"><div style="color:#666;font-size:13px">Доход</div><div class="val green">+${totalIncome.toLocaleString("ru-RU")} ₽</div></div>
<div class="summary-item"><div style="color:#666;font-size:13px">Расходы</div><div class="val red">−${totalExpenses.toLocaleString("ru-RU")} ₽</div></div>
<div class="summary-item"><div style="color:#666;font-size:13px">Прибыль</div><div class="val ${netProfit >= 0 ? "green" : "red"}">${netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString("ru-RU")} ₽</div></div>
</div>

<h2>Доходы по методу оплаты</h2>
<table><tr><th>Метод</th><th>Сумма</th></tr>
${Object.entries(incByMethod).map(([m, v]) => `<tr><td>${methodLabels[m] || m}</td><td>${v.toLocaleString("ru-RU")} ₽</td></tr>`).join("")}
</table>

<h2>Расходы по категориям</h2>
<table><tr><th>Категория</th><th>Сумма</th><th>Доля</th></tr>
${Object.entries(expByCategory).map(([c, v]) => `<tr><td>${catLabels[c] || c}</td><td>${v.toLocaleString("ru-RU")} ₽</td><td>${totalExpenses > 0 ? ((v / totalExpenses) * 100).toFixed(1) : 0}%</td></tr>`).join("")}
<tr style="font-weight:bold"><td>Итого</td><td>${totalExpenses.toLocaleString("ru-RU")} ₽</td><td>100%</td></tr>
</table>

<h2>Статус оплат по заказам</h2>
<table><tr><th>Статус</th><th>Количество</th></tr>
<tr><td>✅ Оплачен</td><td>${paidOrders}</td></tr>
<tr><td>⏳ Частично</td><td>${partialOrders}</td></tr>
<tr><td>❌ Не оплачен</td><td>${unpaidOrders}</td></tr>
<tr style="font-weight:bold"><td>Всего</td><td>${orders.length}</td></tr></table>

<h2>Последние поступления</h2>
<table><tr><th>Дата</th><th>Сумма</th><th>Метод</th></tr>
${payments.slice(0, 10).map((p: any) => `<tr><td>${p.payment_date}</td><td>${Number(p.amount).toLocaleString("ru-RU")} ₽</td><td>${methodLabels[p.payment_method] || p.payment_method}</td></tr>`).join("")}
</table>

<h2>Последние расходы</h2>
<table><tr><th>Дата</th><th>Описание</th><th>Категория</th><th>Сумма</th></tr>
${expenses.slice(0, 10).map((e: any) => `<tr><td>${e.expense_date}</td><td>${e.description}</td><td>${catLabels[e.category] || e.category}</td><td>${Number(e.amount).toLocaleString("ru-RU")} ₽</td></tr>`).join("")}
</table>

<p style="margin-top:40px;text-align:center;color:#999;font-size:12px">Документ сформирован автоматически системой AlpinPro</p>
</body></html>`;
}

// ─── CSV Export helper ────────────────────
function exportCSV(data: any[], filename: string, headers: string[], rowFn: (item: any) => string[]) {
  const csv = "\uFEFF" + headers.join(";") + "\n" + data.map((item) => rowFn(item).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV экспортирован");
}

// ─── Component ────────────────────────────
export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("estimates");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportPeriod, setReportPeriod] = useState("month");

  // ─── Contract creation form ────
  const [formData, setFormData] = useState({
    type: "contract", client_name: "", client_email: "", client_phone: "",
    description: "", total_price: "",
  });
  const [selectedEstimateId, setSelectedEstimateId] = useState("");

  // ─── Queries ────
  const { data: estimates = [] } = useQuery({
    queryKey: ["doc-estimates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Estimate[];
    },
    enabled: !!user,
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ["doc-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!user,
  });

  const { data: agreedEstimates = [] } = useQuery({
    queryKey: ["doc-agreed-estimates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("id, client_name, service_name, total_price").eq("status", "agreed");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["doc-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["doc-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["doc-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ─── Mutations ────
  const createContractMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const number = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(contracts.length + 1).padStart(2, "0")}`;
      let estimate = null;
      if (selectedEstimateId && selectedEstimateId !== "none") {
        const { data } = await supabase.from("estimates").select("*").eq("id", selectedEstimateId).single();
        estimate = data;
      }
      const { error } = await supabase.from("contracts").insert({
        user_id: user!.id, type: formData.type, number,
        client_name: estimate?.client_name || formData.client_name,
        client_email: estimate?.client_email || formData.client_email || null,
        client_phone: estimate?.client_phone || formData.client_phone || null,
        description: formData.description || null,
        total_price: estimate?.total_price || Number(formData.total_price) || 0,
        estimate_id: (selectedEstimateId && selectedEstimateId !== "none") ? selectedEstimateId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-contracts"] });
      setCreateOpen(false);
      setFormData({ type: "contract", client_name: "", client_email: "", client_phone: "", description: "", total_price: "" });
      setSelectedEstimateId("");
      toast.success("Документ создан");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").update({ status: "sent" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["doc-contracts"] }); toast.success("Отправлено на подписание"); },
  });

  const copyLink = (token: string, type: string) => {
    const path = type === "contract" || type === "act" ? "contract" : "estimate";
    navigator.clipboard.writeText(`${window.location.origin}/${path}?token=${token}`);
    toast.success("Ссылка скопирована");
  };

  // ─── Financial report data ────
  const reportRange = useMemo(() => {
    const now = new Date();
    if (reportPeriod === "month") return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "LLLL yyyy", { locale: ru }) };
    if (reportPeriod === "quarter") return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), label: `${format(subMonths(now, 2), "LLL", { locale: ru })} — ${format(now, "LLL yyyy", { locale: ru })}` };
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31), label: `${now.getFullYear()} год` };
  }, [reportPeriod]);

  const inRange = (d: string) => { try { return isWithinInterval(parseISO(d), reportRange); } catch { return false; } };
  const rPayments = payments.filter((p: any) => inRange(p.payment_date));
  const rExpenses = expenses.filter((e: any) => inRange(e.expense_date));
  const rIncome = rPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const rExpTotal = rExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  // ─── Doc row renderer ────
  const DocRow = ({ icon, title, subtitle, date, badge, badgeVariant, actions }: {
    icon: React.ReactNode; title: string; subtitle?: string; date: string;
    badge: string; badgeVariant: "default" | "secondary" | "outline"; actions: React.ReactNode;
  }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:shadow-sm hover:border-primary/20 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
        <div>
          <h3 className="text-sm font-medium text-card-foreground">{title}</h3>
          <div className="flex items-center gap-3 mt-0.5">
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant}>{badge}</Badge>
        {actions}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Документы</h1>
          <p className="text-muted-foreground text-sm mt-1">Сметы, договоры, акты и отчёты</p>
        </div>
        <div className="flex gap-2">
          {tab === "contracts" && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Создать</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Новый документ</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Тип</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">Договор</SelectItem>
                          <SelectItem value="act">Акт выполненных работ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>На основе сметы</Label>
                      <Select value={selectedEstimateId} onValueChange={setSelectedEstimateId}>
                        <SelectTrigger><SelectValue placeholder="Без сметы" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Без сметы</SelectItem>
                          {agreedEstimates.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.client_name} — {e.service_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(!selectedEstimateId || selectedEstimateId === "none") && (
                    <>
                      <div><Label>Клиент</Label><Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Email</Label><Input value={formData.client_email} onChange={(e) => setFormData({ ...formData, client_email: e.target.value })} /></div>
                        <div><Label>Телефон</Label><Input value={formData.client_phone} onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })} /></div>
                      </div>
                      <div><Label>Сумма, ₽</Label><Input type="number" value={formData.total_price} onChange={(e) => setFormData({ ...formData, total_price: e.target.value })} /></div>
                    </>
                  )}
                  <div><Label>Описание работ</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
                  <Button onClick={() => createContractMutation.mutate()} disabled={createContractMutation.isPending} className="w-full">
                    {createContractMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Создать
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <ClipboardList className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold text-foreground">{estimates.length}</p>
          <p className="text-[11px] text-muted-foreground">Сметы</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <FileText className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold text-foreground">{contracts.filter((c) => c.type === "contract").length}</p>
          <p className="text-[11px] text-muted-foreground">Договоры</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <Receipt className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold text-foreground">{contracts.filter((c) => c.type === "act").length}</p>
          <p className="text-[11px] text-muted-foreground">Акты</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <BarChart3 className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold text-foreground">{contracts.filter((c) => c.status === "signed").length}</p>
          <p className="text-[11px] text-muted-foreground">Подписано</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="estimates" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Сметы</TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Договоры / Акты</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Отчёты</TabsTrigger>
        </TabsList>

        {/* ─── ESTIMATES ──── */}
        <TabsContent value="estimates" className="space-y-3 mt-4">
          {estimates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Нет смет</p><p className="text-sm mt-1">Создайте смету в калькуляторе</p></div>
          ) : estimates.map((est) => (
            <DocRow key={est.id}
              icon={<ClipboardList className="w-5 h-5 text-primary" />}
              title={`Смета: ${est.service_name}`}
              subtitle={`${est.client_name} • ${Number(est.total_price).toLocaleString("ru-RU")} ₽`}
              date={format(parseISO(est.created_at), "dd.MM.yyyy")}
              badge={estimateStatusConfig[est.status]?.label || est.status}
              badgeVariant={estimateStatusConfig[est.status]?.variant || "secondary"}
              actions={<>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="PDF" onClick={() => openPrintWindow(generateEstimatePdf(est), `Смета_${est.client_name}`)}>
                  <Printer className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Ссылка" onClick={() => copyLink(est.token, "estimate")}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="CSV" onClick={() => exportCSV(
                  [est], `estimate_${est.client_name}.csv`,
                  ["Клиент", "Услуга", "Объём", "Ед.", "Цена", "Коэфф.", "Итого"],
                  (e) => [e.client_name, e.service_name, e.volume, e.unit, e.base_price, e.total_coeff, e.total_price]
                )}>
                  <Download className="w-4 h-4" />
                </Button>
              </>}
            />
          ))}
        </TabsContent>

        {/* ─── CONTRACTS & ACTS ──── */}
        <TabsContent value="contracts" className="space-y-3 mt-4">
          {contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Нет документов</p></div>
          ) : contracts.map((c) => (
            <DocRow key={c.id}
              icon={<FileText className="w-5 h-5 text-primary" />}
              title={`${c.type === "act" ? "Акт" : "Договор"} №${c.number} — ${c.client_name}`}
              subtitle={`${Number(c.total_price).toLocaleString("ru-RU")} ₽`}
              date={format(parseISO(c.created_at), "dd.MM.yyyy")}
              badge={contractStatusConfig[c.status]?.label || c.status}
              badgeVariant={contractStatusConfig[c.status]?.variant || "secondary"}
              actions={<>
                {c.signed_at && <CheckCircle className="w-4 h-4 text-green-600" />}
                <Button variant="ghost" size="icon" className="h-8 w-8" title="PDF" onClick={() => openPrintWindow(generateContractPdf(c), `${c.type}_${c.number}`)}>
                  <Printer className="w-4 h-4" />
                </Button>
                {c.status === "draft" && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => sendMutation.mutate(c.id)}>
                    <Send className="w-3.5 h-3.5" /> Отправить
                  </Button>
                )}
                {c.status === "sent" && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => copyLink(c.token, c.type)}>
                    <ExternalLink className="w-3.5 h-3.5" /> Ссылка
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" title="CSV" onClick={() => exportCSV(
                  [c], `${c.type}_${c.number}.csv`,
                  ["Тип", "Номер", "Клиент", "Сумма", "Статус", "Дата"],
                  (d) => [d.type, d.number, d.client_name, d.total_price, d.status, d.created_at]
                )}>
                  <Download className="w-4 h-4" />
                </Button>
              </>}
            />
          ))}
        </TabsContent>

        {/* ─── REPORTS ──── */}
        <TabsContent value="reports" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={reportPeriod} onValueChange={setReportPeriod}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Месяц</SelectItem>
                <SelectItem value="quarter">Квартал</SelectItem>
                <SelectItem value="year">Год</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-1.5" onClick={() => openPrintWindow(
              generateFinancialReport(rPayments, rExpenses, orders, reportRange.label, rIncome, rExpTotal, rIncome - rExpTotal),
              `Отчёт_${reportRange.label}`
            )}>
              <Printer className="w-4 h-4" /> PDF отчёт
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => {
              const allTxns = [
                ...rPayments.map((p: any) => ({ date: p.payment_date, type: "Доход", desc: `Оплата заказа`, amount: p.amount, method: p.payment_method })),
                ...rExpenses.map((e: any) => ({ date: e.expense_date, type: "Расход", desc: e.description, amount: e.amount, method: e.payment_method })),
              ];
              exportCSV(allTxns, `report_${reportPeriod}.csv`, ["Дата", "Тип", "Описание", "Сумма", "Метод"], (t) => [t.date, t.type, t.desc, t.amount, t.method]);
            }}>
              <Download className="w-4 h-4" /> Excel (CSV)
            </Button>
          </div>

          {/* Report summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Доход</p>
              <p className="text-2xl font-bold text-green-600 mt-1">+{rIncome.toLocaleString("ru-RU")} ₽</p>
              <p className="text-xs text-muted-foreground mt-1">{rPayments.length} поступлений</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Расходы</p>
              <p className="text-2xl font-bold text-red-500 mt-1">−{rExpTotal.toLocaleString("ru-RU")} ₽</p>
              <p className="text-xs text-muted-foreground mt-1">{rExpenses.length} операций</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Чистая прибыль</p>
              <p className={`text-2xl font-bold mt-1 ${(rIncome - rExpTotal) >= 0 ? "text-green-600" : "text-red-500"}`}>
                {(rIncome - rExpTotal) >= 0 ? "+" : ""}{(rIncome - rExpTotal).toLocaleString("ru-RU")} ₽
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Маржа: {rIncome > 0 ? (((rIncome - rExpTotal) / rIncome) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          {/* Recent transactions preview */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-card-foreground">Последние операции за {reportRange.label}</h3>
            </div>
            <div className="divide-y divide-border">
              {[
                ...rPayments.slice(0, 5).map((p: any) => ({ id: p.id, type: "income" as const, desc: `Оплата заказа`, amount: Number(p.amount), date: p.payment_date })),
                ...rExpenses.slice(0, 5).map((e: any) => ({ id: e.id, type: "expense" as const, desc: e.description, amount: Number(e.amount), date: e.expense_date })),
              ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${t.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {t.type === "income" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm text-card-foreground">{t.desc}</p>
                      <p className="text-[11px] text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-semibold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                    {t.type === "income" ? "+" : "−"}{t.amount.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              ))}
              {rPayments.length === 0 && rExpenses.length === 0 && (
                <p className="text-center py-8 text-sm text-muted-foreground">Нет операций за период</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader><DialogTitle>Предпросмотр</DialogTitle></DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="w-full flex-1 rounded-lg border border-border" style={{ height: "calc(80vh - 80px)" }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
