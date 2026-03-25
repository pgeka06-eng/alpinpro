import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, Send, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const services = [
  { id: "wash", name: "Мойка фасада", unit: "м²", price: 250 },
  { id: "seal", name: "Герметизация швов", unit: "п.м.", price: 800 },
  { id: "paint", name: "Покраска фасада", unit: "м²", price: 450 },
  { id: "insulation", name: "Утепление фасада", unit: "м²", price: 1200 },
  { id: "glass", name: "Мойка остекления", unit: "м²", price: 350 },
  { id: "repair", name: "Ремонт кровли", unit: "м²", price: 900 },
  { id: "install", name: "Монтаж конструкций", unit: "шт", price: 5000 },
];

const coeffLabels = {
  urgency: ["Обычный", "Срочный", "Очень срочный"],
  complexity: ["Простой", "Средний", "Сложный"],
  height: ["до 20м", "20-50м", "50-100м", "100м+"],
  season: ["Лето", "Межсезонье", "Зима"],
};

const coeffValues = {
  urgency: [1, 1.3, 1.6],
  complexity: [1, 1.25, 1.5],
  height: [1, 1.2, 1.5, 2.0],
  season: [1, 1.1, 1.3],
};

const MIN_ORDER = 15000;
const MIN_MARGIN = 0.25;

export default function CalculatorPage() {
  const [selectedService, setSelectedService] = useState("");
  const [volume, setVolume] = useState("");
  const [urgency, setUrgency] = useState(0);
  const [complexity, setComplexity] = useState(0);
  const [height, setHeight] = useState(0);
  const [season, setSeason] = useState(0);

  const service = services.find((s) => s.id === selectedService);

  const calculation = useMemo(() => {
    if (!service || !volume || Number(volume) <= 0) return null;
    const basePrice = service.price * Number(volume);
    const coeff =
      coeffValues.urgency[urgency] *
      coeffValues.complexity[complexity] *
      coeffValues.height[height] *
      coeffValues.season[season];
    let total = Math.round(basePrice * coeff);
    if (total < MIN_ORDER) total = MIN_ORDER;
    const margin = (total - basePrice) / total;
    return { basePrice, coeff, total, margin, isCheap: margin < MIN_MARGIN };
  }, [service, volume, urgency, complexity, height, season]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Калькулятор стоимости</h1>
        <p className="text-muted-foreground text-sm mt-1">Быстрый расчёт стоимости высотных работ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 bg-card rounded-xl border border-border p-6 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Услуга</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger><SelectValue placeholder="Выберите услугу" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.price} ₽/{s.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Объём {service ? `(${service.unit})` : ""}</Label>
              <Input
                type="number"
                placeholder="Введите объём"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
          </div>

          {/* Coefficients */}
          <div className="space-y-5">
            {[
              { key: "urgency" as const, label: "Срочность", val: urgency, set: setUrgency },
              { key: "complexity" as const, label: "Сложность", val: complexity, set: setComplexity },
              { key: "height" as const, label: "Высота", val: height, set: setHeight },
              { key: "season" as const, label: "Сезон", val: season, set: setSeason },
            ].map(({ key, label, val, set }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <span className="text-xs font-mono text-primary font-semibold">
                    ×{coeffValues[key][val]}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={coeffLabels[key].length - 1}
                  step={1}
                  value={[val]}
                  onValueChange={([v]) => set(v)}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  {coeffLabels[key].map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Result */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 text-card-foreground">
              <Calculator className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Расчёт</h3>
            </div>

            {calculation ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Базовая стоимость</span>
                  <span className="font-mono">{calculation.basePrice.toLocaleString("ru")} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Коэффициент</span>
                  <span className="font-mono text-primary">×{calculation.coeff.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Мин. заказ</span>
                  <span className="font-mono">{MIN_ORDER.toLocaleString("ru")} ₽</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-card-foreground">Итого</span>
                    <span className="text-3xl font-bold font-mono text-gradient">
                      {calculation.total.toLocaleString("ru")} ₽
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Маржа</span>
                  <span className={`font-mono font-medium ${calculation.isCheap ? "text-destructive" : "text-success"}`}>
                    {(calculation.margin * 100).toFixed(0)}%
                  </span>
                </div>

                {calculation.isCheap && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Маржа ниже {MIN_MARGIN * 100}%. Рекомендуем повысить цену.</span>
                  </div>
                )}

                <Button className="w-full mt-2 gap-2" size="lg">
                  <Send className="w-4 h-4" />
                  Отправить клиенту
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Выберите услугу и укажите объём для расчёта
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
