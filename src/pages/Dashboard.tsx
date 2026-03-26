import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Wallet, ClipboardList, TrendingUp, Users, Clock, Calculator,
  ArrowRight, CheckCircle, AlertCircle, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { SmartNotifications } from "@/components/SmartNotifications";
import { ru } from "date-fns/locale";

const statusConfig: Record<string, { label: string; class: string }> = {
  created: { label: "Создано", class: "bg-muted text-muted-foreground" },
  agreed: { label: "Согласовано", class: "bg-info/10 text-info" },
  in_progress: { label: "В работе", class: "bg-warning/10 text-warning" },
  completed: { label: "Завершено", class: "bg-success/10 text-success" },
};

const paymentStatusConfig: Record<string, { label: string; class: string }> = {
  paid: { label: "Оплачен", class: "text-success" },
  partial: { label: "Частично", class: "text-warning" },
  unpaid: { label: "Не оплачен", class: "text-destructive" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ["dash-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["dash-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["dash-estimates"],
    queryFn: async () => {
      const { data } = await supabase.from("estimates").select("id, status, created_at").order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // ─── Computed ────
  const now = new Date();
  const thisMonth = { start: startOfMonth(now), end: endOfMonth(now) };
  const lastMonth = { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };

  const inRange = (d: string, range: { start: Date; end: Date }) => {
    try { const dt = parseISO(d); return dt >= range.start && dt <= range.end; } catch { return false; }
  };

  const thisMonthIncome = payments.filter((p: any) => inRange(p.payment_date, thisMonth)).reduce((s, p: any) => s + Number(p.amount), 0);
  const lastMonthIncome = payments.filter((p: any) => inRange(p.payment_date, lastMonth)).reduce((s, p: any) => s + Number(p.amount), 0);
  const incomeChange = lastMonthIncome > 0 ? Math.round(((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100) : 0;

  const thisMonthExpenses = expenses.filter((e: any) => inRange(e.expense_date, thisMonth)).reduce((s, e: any) => s + Number(e.amount), 0);
  const profit = thisMonthIncome - thisMonthExpenses;

  const activeOrders = orders.filter((o: any) => o.status === "in_progress" || o.status === "agreed").length;
  const unpaidOrders = orders.filter((o: any) => o.payment_status === "unpaid" || o.payment_status === "partial");
  const unpaidTotal = unpaidOrders.reduce((s, o: any) => s + (Number(o.total_price) - Number(o.paid_amount)), 0);

  const avgCheck = orders.length > 0 ? Math.round(orders.reduce((s, o: any) => s + Number(o.total_price), 0) / orders.length) : 0;

  // Revenue last 14 days
  const revenueChart = useMemo(() => {
    const days: Record<string, { income: number; expense: number }> = {};
    for (let i = 13; i >= 0; i--) {
      days[format(subDays(now, i), "dd.MM")] = { income: 0, expense: 0 };
    }
    payments.forEach((p: any) => {
      const d = format(parseISO(p.payment_date), "dd.MM");
      if (days[d]) days[d].income += Number(p.amount);
    });
    expenses.forEach((e: any) => {
      const d = format(parseISO(e.expense_date), "dd.MM");
      if (days[d]) days[d].expense += Number(e.amount);
    });
    return Object.entries(days).map(([date, v]) => ({ date, ...v }));
  }, [payments, expenses]);

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Header + quick action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Дашборд</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {format(now, "d MMMM yyyy", { locale: ru })}
          </p>
        </div>
        <Button onClick={() => navigate("/calculator")} className="gap-2" size="sm">
          <Calculator className="w-4 h-4" /> Расчёт
        </Button>
      </div>

      {/* Key metrics — 2x2 on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <Wallet className="w-4 h-4 text-success" />
            {incomeChange !== 0 && (
              <span className={`text-[11px] font-medium ${incomeChange > 0 ? "text-success" : "text-destructive"}`}>
                {incomeChange > 0 ? "+" : ""}{incomeChange}%
              </span>
            )}
          </div>
          <p className="text-lg sm:text-xl font-bold text-foreground mt-2 font-mono">{thisMonthIncome.toLocaleString("ru-RU")} ₽</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Доход за месяц</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-xl border border-border p-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className={`text-lg sm:text-xl font-bold mt-2 font-mono ${profit >= 0 ? "text-foreground" : "text-destructive"}`}>
            {profit.toLocaleString("ru-RU")} ₽
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Чистая прибыль</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-4">
          <ClipboardList className="w-4 h-4 text-warning" />
          <p className="text-lg sm:text-xl font-bold text-foreground mt-2">{activeOrders}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Активных заказов</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/20 transition-colors"
          onClick={() => navigate("/accounting")}>
          <DollarSign className="w-4 h-4 text-destructive" />
          <p className="text-lg sm:text-xl font-bold text-foreground mt-2 font-mono">{unpaidTotal.toLocaleString("ru-RU")} ₽</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">К получению</p>
        </motion.div>
      </div>

      {/* Chart + unpaid alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-card-foreground">Доходы / Расходы (14 дней)</h3>
            <span className="text-[11px] text-muted-foreground">Средний чек: {avgCheck.toLocaleString("ru-RU")} ₽</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueChart} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: number, name: string) => [`${v.toLocaleString("ru-RU")} ₽`, name === "income" ? "Доход" : "Расход"]} />
              <Bar dataKey="income" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(var(--muted-foreground) / 0.25)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quick status */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-card-foreground">Статус заказов</h3>
          {["created", "agreed", "in_progress", "completed"].map((status) => {
            const count = orders.filter((o: any) => o.status === status).length;
            const config = statusConfig[status];
            return (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    status === "created" ? "bg-muted-foreground" :
                    status === "agreed" ? "bg-info" :
                    status === "in_progress" ? "bg-warning" : "bg-success"
                  }`} />
                  <span className="text-sm text-card-foreground">{config.label}</span>
                </div>
                <span className="font-mono text-sm font-semibold">{count}</span>
              </div>
            );
          })}
          <div className="border-t border-border pt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Всего</span>
            <span className="font-semibold">{orders.length}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" onClick={() => navigate("/orders")}>
            <ClipboardList className="w-3.5 h-3.5" /> Все заказы <ArrowRight className="w-3 h-3 ml-auto" />
          </Button>
        </motion.div>
      </div>

      {/* Recent orders — card layout for mobile */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">Последние заказы</h3>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Заказ</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Услуга</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Сумма</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Оплата</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order: any) => {
                const sc = statusConfig[order.status] || statusConfig.created;
                const pc = paymentStatusConfig[order.payment_status] || paymentStatusConfig.unpaid;
                return (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono font-medium text-card-foreground">{order.order_number}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.service_name}</td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-card-foreground">
                      {Number(order.total_price).toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${pc.class}`}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.class}`}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Нет заказов</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-border">
          {recentOrders.map((order: any) => {
            const sc = statusConfig[order.status] || statusConfig.created;
            const pc = paymentStatusConfig[order.payment_status] || paymentStatusConfig.unpaid;
            return (
              <div key={order.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{order.order_number}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sc.class}`}>{sc.label}</span>
                </div>
                <p className="text-sm font-medium text-card-foreground">{order.service_name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-bold">{Number(order.total_price).toLocaleString("ru-RU")} ₽</span>
                  <span className={`text-xs font-medium ${pc.class}`}>{pc.label}</span>
                </div>
              </div>
            );
          })}
          {recentOrders.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">Нет заказов</p>
          )}
        </div>
      </motion.div>

      {/* Unpaid alert */}
      {unpaidOrders.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-card-foreground">
              {unpaidOrders.length} {unpaidOrders.length === 1 ? "заказ" : "заказов"} ожидает оплаты
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Общая задолженность: {unpaidTotal.toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto flex-shrink-0" onClick={() => navigate("/accounting")}>
            Подробнее
          </Button>
        </motion.div>
      )}
    </div>
  );
}
