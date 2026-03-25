import { useState } from "react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { Wallet, TrendingUp, TrendingDown, Receipt, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const monthlyData = [
  { month: "Янв", доход: 320000, расход: 180000, прибыль: 140000 },
  { month: "Фев", доход: 450000, расход: 220000, прибыль: 230000 },
  { month: "Мар", доход: 380000, расход: 190000, прибыль: 190000 },
  { month: "Апр", доход: 520000, расход: 260000, прибыль: 260000 },
  { month: "Май", доход: 610000, расход: 280000, прибыль: 330000 },
  { month: "Июн", доход: 580000, расход: 310000, прибыль: 270000 },
];

const expenseBreakdown = [
  { name: "Материалы", value: 120000 },
  { name: "Транспорт", value: 45000 },
  { name: "Аренда", value: 60000 },
  { name: "Зарплаты", value: 150000 },
  { name: "Прочее", value: 25000 },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--muted-foreground))",
];

const transactions = [
  { id: 1, desc: "Оплата: ТЦ Мега — Покраска фасада", amount: 340000, type: "income", date: "15.03" },
  { id: 2, desc: "Материалы: краска, растворитель", amount: -28000, type: "expense", date: "14.03" },
  { id: 3, desc: "Оплата: ООО Стройком — Мойка фасада", amount: 85000, type: "income", date: "13.03" },
  { id: 4, desc: "Транспорт: доставка оборудования", amount: -12000, type: "expense", date: "12.03" },
  { id: 5, desc: "Оплата: БЦ Премиум — Мойка остекления", amount: 65000, type: "income", date: "11.03" },
];

export default function AccountingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Бухгалтерия</h1>
        <p className="text-muted-foreground text-sm mt-1">Финансовая аналитика и учёт</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Доход за месяц" value="580 000 ₽" change="+12%" changeType="positive" icon={Wallet} />
        <StatCard title="Расходы" value="310 000 ₽" change="+5%" changeType="negative" icon={TrendingDown} />
        <StatCard title="Чистая прибыль" value="270 000 ₽" change="+8%" changeType="positive" icon={TrendingUp} />
        <StatCard title="Средний чек" value="142 000 ₽" change="+3%" changeType="positive" icon={Receipt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card rounded-xl border border-border p-6"
        >
          <h3 className="text-base font-semibold text-card-foreground mb-4">Доход / Расход / Прибыль</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}к`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="доход" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="расход" fill="hsl(var(--destructive) / 0.5)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="прибыль" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Expense breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <h3 className="text-base font-semibold text-card-foreground mb-4">Структура расходов</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {expenseBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {expenseBreakdown.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-mono text-card-foreground">{(item.value / 1000).toFixed(0)}к ₽</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-xl border border-border"
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">Последние операции</h3>
        </div>
        <div className="divide-y divide-border">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}>
                  {t.type === "income" ? (
                    <ArrowUpRight className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{t.desc}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
              </div>
              <span className={`font-mono font-semibold text-sm ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                {t.type === "income" ? "+" : ""}{t.amount.toLocaleString("ru")} ₽
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
