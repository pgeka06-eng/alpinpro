import { motion } from "framer-motion";
import { Star, MapPin, Briefcase, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const climbers = [
  { name: "Иванов Алексей", city: "Москва", rating: 4.8, orders: 156, avgCheck: 95000, specialties: ["Мойка фасадов", "Герметизация"], reliability: 97 },
  { name: "Петров Сергей", city: "Санкт-Петербург", rating: 4.6, orders: 98, avgCheck: 120000, specialties: ["Покраска", "Утепление"], reliability: 94 },
  { name: "Сидоров Виктор", city: "Казань", rating: 4.9, orders: 210, avgCheck: 85000, specialties: ["Мойка остекления", "Монтаж"], reliability: 99 },
  { name: "Козлов Дмитрий", city: "Новосибирск", rating: 4.5, orders: 74, avgCheck: 110000, specialties: ["Ремонт кровли", "Герметизация"], reliability: 91 },
  { name: "Михайлов Андрей", city: "Екатеринбург", rating: 4.7, orders: 132, avgCheck: 102000, specialties: ["Покраска", "Мойка фасадов"], reliability: 96 },
  { name: "Волков Николай", city: "Москва", rating: 4.4, orders: 56, avgCheck: 78000, specialties: ["Утепление"], reliability: 88 },
];

export default function ClimbersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Альпинисты</h1>
        <p className="text-muted-foreground text-sm mt-1">Профили и рейтинг специалистов</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {climbers.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                {c.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-card-foreground truncate">{c.name}</h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{c.city}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-warning/10 px-2 py-1 rounded-md">
                <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                <span className="text-sm font-semibold text-warning">{c.rating}</span>
              </div>
            </div>

            <div className="flex gap-1.5 mt-3 flex-wrap">
              {c.specialties.map((s) => (
                <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Briefcase className="w-3 h-3" />
                </div>
                <p className="text-sm font-bold font-mono text-card-foreground">{c.orders}</p>
                <p className="text-[10px] text-muted-foreground">заказов</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="w-3 h-3" />
                </div>
                <p className="text-sm font-bold font-mono text-card-foreground">{(c.avgCheck / 1000).toFixed(0)}к</p>
                <p className="text-[10px] text-muted-foreground">ср. чек</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Star className="w-3 h-3" />
                </div>
                <p className="text-sm font-bold font-mono text-card-foreground">{c.reliability}%</p>
                <p className="text-[10px] text-muted-foreground">надёжн.</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
