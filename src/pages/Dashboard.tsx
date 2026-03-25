import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { Wallet, ClipboardList, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const revenueData = [
  { month: "Янв", доход: 320000, расход: 180000 },
  { month: "Фев", доход: 450000, расход: 220000 },
  { month: "Мар", доход: 380000, расход: 190000 },
  { month: "Апр", доход: 520000, расход: 260000 },
  { month: "Май", доход: 610000, расход: 280000 },
  { month: "Июн", доход: 580000, расход: 310000 },
];

const recentOrders = [
  { id: "ORD-2401", client: "ООО Стройком", service: "Мойка фасада", amount: "85 000 ₽", status: "В работе" },
  { id: "ORD-2402", client: "ИП Иванов", service: "Герметизация швов", amount: "120 000 ₽", status: "Согласовано" },
  { id: "ORD-2403", client: "ТЦ Мега", service: "Покраска фасада", amount: "340 000 ₽", status: "Завершено" },
  { id: "ORD-2404", client: "ЖК Солнечный", service: "Утепление", amount: "250 000 ₽", status: "Создано" },
];

const statusColors: Record<string, string> = {
  "Создано": "bg-muted text-muted-foreground",
  "Согласовано": "bg-info/10 text-info",
  "В работе": "bg-warning/10 text-warning",
  "Завершено": "bg-success/10 text-success",
};

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground text-sm mt-1">Обзор деятельности за текущий месяц</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Доход за месяц" value="580 000 ₽" change="+12% к прошлому" changeType="positive" icon={Wallet} />
        <StatCard title="Активные заказы" value="14" change="3 новых сегодня" changeType="neutral" icon={ClipboardList} />
        <StatCard title="Чистая прибыль" value="270 000 ₽" change="+8% к прошлому" changeType="positive" icon={TrendingUp} />
        <StatCard title="Альпинисты" value="8" change="2 на объектах" changeType="neutral" icon={Users} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h3 className="text-base font-semibold text-card-foreground mb-4">Доходы и расходы</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}к`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Bar dataKey="доход" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="расход" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h3 className="text-base font-semibold text-card-foreground mb-4">Динамика прибыли</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}к`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="доход" stroke="hsl(var(--primary))" fill="url(#profitGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-xl border border-border"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-card-foreground">Последние заказы</h3>
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Клиент</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Услуга</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Сумма</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono font-medium text-card-foreground">{order.id}</td>
                  <td className="px-6 py-4 text-sm text-card-foreground">{order.client}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{order.service}</td>
                  <td className="px-6 py-4 text-sm font-mono font-semibold text-card-foreground">{order.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
