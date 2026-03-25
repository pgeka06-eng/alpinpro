import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const orders = [
  { id: "ORD-2401", client: "ООО Стройком", service: "Мойка фасада", amount: 85000, status: "in_progress", date: "2024-03-15", climber: "Иванов А." },
  { id: "ORD-2402", client: "ИП Иванов", service: "Герметизация швов", amount: 120000, status: "agreed", date: "2024-03-14", climber: "Петров С." },
  { id: "ORD-2403", client: "ТЦ Мега", service: "Покраска фасада", amount: 340000, status: "done", date: "2024-03-10", climber: "Сидоров В." },
  { id: "ORD-2404", client: "ЖК Солнечный", service: "Утепление", amount: 250000, status: "created", date: "2024-03-16", climber: "—" },
  { id: "ORD-2405", client: "БЦ Премиум", service: "Мойка остекления", amount: 65000, status: "done", date: "2024-03-08", climber: "Козлов Д." },
  { id: "ORD-2406", client: "ООО Фасад+", service: "Ремонт кровли", amount: 180000, status: "in_progress", date: "2024-03-13", climber: "Иванов А." },
];

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created: { label: "Создано", variant: "secondary" },
  agreed: { label: "Согласовано", variant: "outline" },
  in_progress: { label: "В работе", variant: "default" },
  done: { label: "Завершено", variant: "secondary" },
};

export default function OrdersPage() {
  const [search, setSearch] = useState("");

  const filtered = orders.filter(
    (o) =>
      o.client.toLowerCase().includes(search.toLowerCase()) ||
      o.service.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Заказы</h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} заказов</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Новый заказ
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по клиенту, услуге или ID..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card rounded-xl border border-border overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ID", "Дата", "Клиент", "Услуга", "Альпинист", "Сумма", "Статус"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order, i) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 text-sm font-mono font-medium text-card-foreground">{order.id}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{order.date}</td>
                  <td className="px-5 py-4 text-sm font-medium text-card-foreground">{order.client}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{order.service}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{order.climber}</td>
                  <td className="px-5 py-4 text-sm font-mono font-semibold text-card-foreground">
                    {order.amount.toLocaleString("ru")} ₽
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={statusMap[order.status].variant}>
                      {statusMap[order.status].label}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
