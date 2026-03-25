import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import {
  Wallet, TrendingUp, TrendingDown, Receipt, ArrowUpRight, ArrowDownRight,
  Plus, Loader2, Download, Calendar as CalendarIcon, CreditCard, Banknote,
  FileText, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  { value: "materials", label: "Материалы" },
  { value: "transport", label: "Транспорт" },
  { value: "rent", label: "Аренда" },
  { value: "salary", label: "Зарплаты" },
  { value: "other", label: "Прочее" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

const PAYMENT_METHODS = [
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Безнал / карта" },
  { value: "transfer", label: "Перевод" },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PAYMENT_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  paid: { label: "Оплачен", icon: CheckCircle, className: "text-green-600" },
  partial: { label: "Частично", icon: Clock, className: "text-yellow-600" },
  unpaid: { label: "Не оплачен", icon: AlertCircle, className: "text-red-500" },
};

type Period = "week" | "month" | "quarter" | "year";

export default function AccountingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Expense form
  const [expForm, setExpForm] = useState({
    category: "materials", description: "", amount: "", payment_method: "cash",
    include_vat: false, expense_date: format(new Date(), "yyyy-MM-dd"), order_id: "",
  });

  // Payment form
  const [payForm, setPayForm] = useState({
    order_id: "", amount: "", payment_method: "cash", include_vat: false,
    payment_date: format(new Date(), "yyyy-MM-dd"), note: "",
  });

  // Fetch data
  const { data: orders = [] } = useQuery({
    queryKey: ["accounting-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["accounting-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));

  // Period filtering
  const periodRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week": return { start: startOfWeek(now, { locale: ru }), end: endOfWeek(now, { locale: ru }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter": return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "year": return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
    }
  }, [period]);

  const inPeriod = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, periodRange);
    } catch { return false; }
  };

  // Computed metrics
  const periodPayments = payments.filter((p: any) => inPeriod(p.payment_date));
  const periodExpenses = expenses.filter((e: any) => inPeriod(e.expense_date));

  const totalIncome = periodPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalExpenses = periodExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const avgCheck = periodPayments.length > 0 ? totalIncome / periodPayments.length : 0;

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const diff = periodRange.end.getTime() - periodRange.start.getTime();
    return { start: new Date(periodRange.start.getTime() - diff), end: new Date(periodRange.start.getTime() - 1) };
  }, [periodRange]);

  const inPrevPeriod = (dateStr: string) => {
    try { return isWithinInterval(parseISO(dateStr), prevRange); } catch { return false; }
  };

  const prevIncome = payments.filter((p: any) => inPrevPeriod(p.payment_date)).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const prevExpensesTotal = expenses.filter((e: any) => inPrevPeriod(e.expense_date)).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const prevProfit = prevIncome - prevExpensesTotal;

  const pctChange = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const pct = ((cur - prev) / prev * 100).toFixed(0);
    return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
  };

  // Expense breakdown for pie chart
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    periodExpenses.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name: CATEGORY_LABELS[name] || name, value }));
  }, [periodExpenses]);

  // Monthly chart data (last 6 months)
  const monthlyChart = useMemo(() => {
    const months: { month: string; доход: number; расход: number; прибыль: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const range = { start: ms, end: me };
      const inc = payments.filter((p: any) => { try { return isWithinInterval(parseISO(p.payment_date), range); } catch { return false; } }).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const exp = expenses.filter((e: any) => { try { return isWithinInterval(parseISO(e.expense_date), range); } catch { return false; } }).reduce((s: number, e: any) => s + Number(e.amount), 0);
      months.push({ month: format(d, "LLL", { locale: ru }), доход: inc, расход: exp, прибыль: inc - exp });
    }
    return months;
  }, [payments, expenses]);

  // Payment status counts
  const paymentStatusCounts = useMemo(() => {
    const counts = { paid: 0, partial: 0, unpaid: 0 };
    orders.forEach((o: any) => {
      const status = o.payment_status || "unpaid";
      if (status in counts) counts[status as keyof typeof counts]++;
    });
    return counts;
  }, [orders]);

  // Calendar events
  const calendarEvents = useMemo(() => {
    const events: Record<string, { income: number; expense: number }> = {};
    payments.forEach((p: any) => {
      const key = p.payment_date;
      if (!events[key]) events[key] = { income: 0, expense: 0 };
      events[key].income += Number(p.amount);
    });
    expenses.forEach((e: any) => {
      const key = e.expense_date;
      if (!events[key]) events[key] = { income: 0, expense: 0 };
      events[key].expense += Number(e.amount);
    });
    return events;
  }, [payments, expenses]);

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(expForm.amount);
      const vatAmount = expForm.include_vat ? amount * 0.2 : 0;
      const { error } = await supabase.from("expenses").insert({
        user_id: user!.id,
        category: expForm.category,
        description: expForm.description,
        amount,
        payment_method: expForm.payment_method,
        include_vat: expForm.include_vat,
        vat_amount: vatAmount,
        expense_date: expForm.expense_date,
        order_id: expForm.order_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseOpen(false);
      setExpForm({ category: "materials", description: "", amount: "", payment_method: "cash", include_vat: false, expense_date: format(new Date(), "yyyy-MM-dd"), order_id: "" });
      toast.success("Расход добавлен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(payForm.amount);
      const vatAmount = payForm.include_vat ? amount * 0.2 : 0;
      const { error } = await supabase.from("payments").insert({
        user_id: user!.id,
        order_id: payForm.order_id,
        amount,
        payment_method: payForm.payment_method,
        include_vat: payForm.include_vat,
        vat_amount: vatAmount,
        payment_date: payForm.payment_date,
        note: payForm.note || null,
      });
      if (error) throw error;

      // Update order payment status
      const order = orders.find((o: any) => o.id === payForm.order_id);
      if (order) {
        const newPaid = Number(order.paid_amount || 0) + amount;
        const total = Number(order.total_price);
        const status = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
        await supabase.from("orders").update({
          paid_amount: newPaid,
          payment_status: status,
          payment_date: payForm.payment_date,
          payment_method: payForm.payment_method,
        }).eq("id", payForm.order_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-orders"] });
      setPaymentOpen(false);
      setPayForm({ order_id: "", amount: "", payment_method: "cash", include_vat: false, payment_date: format(new Date(), "yyyy-MM-dd"), note: "" });
      toast.success("Оплата записана");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Transactions list (combined)
  const allTransactions = useMemo(() => {
    const txns: { id: string; desc: string; amount: number; type: "income" | "expense"; date: string; method: string; vat: number }[] = [];
    periodPayments.forEach((p: any) => {
      const order = orders.find((o: any) => o.id === p.order_id);
      txns.push({
        id: p.id, desc: `Оплата: ${order?.order_number || "—"} — ${order?.service_name || ""}`,
        amount: Number(p.amount), type: "income", date: p.payment_date,
        method: p.payment_method, vat: Number(p.vat_amount || 0),
      });
    });
    periodExpenses.forEach((e: any) => {
      txns.push({
        id: e.id, desc: `${CATEGORY_LABELS[e.category] || e.category}: ${e.description}`,
        amount: Number(e.amount), type: "expense", date: e.expense_date,
        method: e.payment_method, vat: Number(e.vat_amount || 0),
      });
    });
    return txns.sort((a, b) => b.date.localeCompare(a.date));
  }, [periodPayments, periodExpenses, orders]);

  // Export handlers
  const exportCSV = () => {
    const header = "Дата;Тип;Описание;Сумма;Метод;НДС\n";
    const rows = allTransactions.map((t) =>
      `${t.date};${t.type === "income" ? "Доход" : "Расход"};${t.desc};${t.amount};${t.method};${t.vat}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV экспортирован");
  };

  const periodLabel = { week: "неделю", month: "месяц", quarter: "квартал", year: "год" }[period];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Бухгалтерия</h1>
          <p className="text-muted-foreground text-sm mt-1">Финансовый учёт за {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="quarter">Квартал</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1"><TrendingDown className="w-4 h-4" /> Расход</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Добавить расход</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Категория</Label>
                    <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Метод оплаты</Label>
                    <Select value={expForm.payment_method} onValueChange={(v) => setExpForm({ ...expForm, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Описание</Label><Input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="Краска, растворитель..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Сумма, ₽</Label><Input type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} /></div>
                  <div><Label>Дата</Label><Input type="date" value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Заказ (опционально)</Label>
                  <Select value={expForm.order_id} onValueChange={(v) => setExpForm({ ...expForm, order_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Без привязки" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без привязки</SelectItem>
                      {orders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.order_number} — {o.service_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={expForm.include_vat} onCheckedChange={(v) => setExpForm({ ...expForm, include_vat: v })} />
                  <Label className="text-sm">Включить НДС 20%</Label>
                  {expForm.include_vat && expForm.amount && (
                    <span className="text-xs text-muted-foreground ml-auto">НДС: {(Number(expForm.amount) * 0.2).toLocaleString("ru-RU")} ₽</span>
                  )}
                </div>
                <Button onClick={() => addExpenseMutation.mutate()} disabled={addExpenseMutation.isPending || !expForm.description || !expForm.amount} className="w-full">
                  {addExpenseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Добавить расход
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1"><ArrowUpRight className="w-4 h-4" /> Оплата</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Записать оплату</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <Label>Заказ</Label>
                  <Select value={payForm.order_id} onValueChange={(v) => setPayForm({ ...payForm, order_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Выберите заказ" /></SelectTrigger>
                    <SelectContent>
                      {orders.filter((o: any) => o.payment_status !== "paid").map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} — {Number(o.total_price).toLocaleString("ru-RU")} ₽ (оплачено {Number(o.paid_amount || 0).toLocaleString("ru-RU")} ₽)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Сумма, ₽</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                  <div>
                    <Label>Метод</Label>
                    <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Дата</Label><Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} /></div>
                <div><Label>Примечание</Label><Input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={payForm.include_vat} onCheckedChange={(v) => setPayForm({ ...payForm, include_vat: v })} />
                  <Label className="text-sm">НДС 20%</Label>
                </div>
                <Button onClick={() => addPaymentMutation.mutate()} disabled={addPaymentMutation.isPending || !payForm.order_id || !payForm.amount} className="w-full">
                  {addPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Записать оплату
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={`Доход за ${periodLabel}`} value={`${totalIncome.toLocaleString("ru-RU")} ₽`} change={pctChange(totalIncome, prevIncome)} changeType={totalIncome >= prevIncome ? "positive" : "negative"} icon={Wallet} />
        <StatCard title="Расходы" value={`${totalExpenses.toLocaleString("ru-RU")} ₽`} change={pctChange(totalExpenses, prevExpensesTotal)} changeType={totalExpenses <= prevExpensesTotal ? "positive" : "negative"} icon={TrendingDown} />
        <StatCard title="Чистая прибыль" value={`${netProfit.toLocaleString("ru-RU")} ₽`} change={pctChange(netProfit, prevProfit)} changeType={netProfit >= prevProfit ? "positive" : "negative"} icon={TrendingUp} />
        <StatCard title="Средний чек" value={`${Math.round(avgCheck).toLocaleString("ru-RU")} ₽`} change="" changeType="positive" icon={Receipt} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="orders">Учёт заказов</TabsTrigger>
          <TabsTrigger value="transactions">Операции</TabsTrigger>
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
              <h3 className="text-base font-semibold text-card-foreground mb-4">Динамика: Доход / Расход / Прибыль</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}к`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} formatter={(v: number) => `${v.toLocaleString("ru-RU")} ₽`} />
                  <Bar dataKey="доход" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="расход" fill="hsl(var(--destructive) / 0.5)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="прибыль" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Expense breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-base font-semibold text-card-foreground mb-4">Структура расходов</h3>
              {expenseByCategory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                        {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} formatter={(v: number) => `${v.toLocaleString("ru-RU")} ₽`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {expenseByCategory.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-mono text-card-foreground">{item.value.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">Нет расходов за период</p>
              )}
            </motion.div>
          </div>

          {/* Profit trend */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-base font-semibold text-card-foreground mb-4">Динамика прибыли</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}к`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(v: number) => `${v.toLocaleString("ru-RU")} ₽`} />
                <Area type="monotone" dataKey="прибыль" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </TabsContent>

        {/* ORDERS PAYMENT STATUS */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            {(["paid", "partial", "unpaid"] as const).map((s) => {
              const cfg = PAYMENT_STATUS_MAP[s];
              const Icon = cfg.icon;
              return (
                <div key={s} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${cfg.className}`} />
                    <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{paymentStatusCounts[s]}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Заказ", "Клиент", "Услуга", "Сумма", "Оплачено", "Остаток", "Статус", "Метод"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => {
                    const paid = Number(o.paid_amount || 0);
                    const total = Number(o.total_price);
                    const remaining = total - paid;
                    const psCfg = PAYMENT_STATUS_MAP[o.payment_status || "unpaid"];
                    const PsIcon = psCfg?.icon || AlertCircle;
                    const clientName = o.client_id ? clientMap.get(o.client_id) : "—";
                    return (
                      <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-card-foreground">{o.order_number}</td>
                        <td className="px-4 py-3 text-sm text-card-foreground">{clientName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{o.service_name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-card-foreground">{total.toLocaleString("ru-RU")} ₽</td>
                        <td className="px-4 py-3 text-sm font-mono text-green-600">{paid.toLocaleString("ru-RU")} ₽</td>
                        <td className="px-4 py-3 text-sm font-mono text-red-500">{remaining > 0 ? `${remaining.toLocaleString("ru-RU")} ₽` : "—"}</td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1 text-xs font-medium ${psCfg?.className || ""}`}>
                            <PsIcon className="w-3.5 h-3.5" /> {psCfg?.label || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {o.payment_method === "card" ? <CreditCard className="w-3.5 h-3.5 inline" /> : <Banknote className="w-3.5 h-3.5 inline" />}
                          {" "}{PAYMENT_METHODS.find((m) => m.value === o.payment_method)?.label || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          {allTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Нет операций за выбранный период</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {allTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {t.type === "income" ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{t.desc}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t.date}</span>
                        <span>•</span>
                        <span>{PAYMENT_METHODS.find((m) => m.value === t.method)?.label || t.method}</span>
                        {t.vat > 0 && <><span>•</span><span>НДС: {t.vat.toLocaleString("ru-RU")} ₽</span></>}
                      </div>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold text-sm ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                    {t.type === "income" ? "+" : "−"}{t.amount.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CALENDAR */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={(d) => d && setCalendarDate(d)}
                locale={ru}
                className={cn("p-3 pointer-events-auto")}
                modifiers={{
                  hasIncome: Object.keys(calendarEvents).filter((k) => calendarEvents[k].income > 0).map((k) => parseISO(k)),
                  hasExpense: Object.keys(calendarEvents).filter((k) => calendarEvents[k].expense > 0).map((k) => parseISO(k)),
                }}
                modifiersStyles={{
                  hasIncome: { borderBottom: "3px solid hsl(var(--primary))" },
                  hasExpense: { borderBottom: "3px solid hsl(var(--destructive))" },
                }}
              />
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-base font-semibold text-card-foreground mb-4">
                {format(calendarDate, "d MMMM yyyy", { locale: ru })}
              </h3>
              {(() => {
                const key = format(calendarDate, "yyyy-MM-dd");
                const ev = calendarEvents[key];
                if (!ev) return <p className="text-sm text-muted-foreground">Нет операций</p>;
                return (
                  <div className="space-y-3">
                    {ev.income > 0 && (
                      <div className="flex items-center gap-3 bg-green-500/5 rounded-lg p-3">
                        <ArrowUpRight className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Доход</p>
                          <p className="text-lg font-bold text-green-600">+{ev.income.toLocaleString("ru-RU")} ₽</p>
                        </div>
                      </div>
                    )}
                    {ev.expense > 0 && (
                      <div className="flex items-center gap-3 bg-red-500/5 rounded-lg p-3">
                        <ArrowDownRight className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Расход</p>
                          <p className="text-lg font-bold text-red-500">−{ev.expense.toLocaleString("ru-RU")} ₽</p>
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">Итого за день</p>
                      <p className={`text-lg font-bold ${(ev.income - ev.expense) >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {(ev.income - ev.expense) >= 0 ? "+" : ""}{(ev.income - ev.expense).toLocaleString("ru-RU")} ₽
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
