import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator, Send, AlertTriangle, Loader2, Database, Info, TrendingUp, ShieldCheck, Lightbulb, Target, ChevronsUpDown, Check, DollarSign, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SendEstimateDialog } from "@/components/SendEstimateDialog";
import { useAuth } from "@/contexts/AuthContext";

interface ServiceItem {
  id: string;
  service_name: string;
  unit: string;
  price: number;
  description: string | null;
  price_list_name?: string;
}

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
const TARGET_MARGIN = 0.40;
const GOOD_MARGIN = 0.35;

// Fallback services when no price lists exist
const fallbackServices: ServiceItem[] = [
  { id: "f-wash", service_name: "Мойка фасада", unit: "м²", price: 250, description: null },
  { id: "f-seal", service_name: "Герметизация швов", unit: "п.м.", price: 800, description: null },
  { id: "f-paint", service_name: "Покраска фасада", unit: "м²", price: 450, description: null },
  { id: "f-insulation", service_name: "Утепление фасада", unit: "м²", price: 1200, description: null },
  { id: "f-glass", service_name: "Мойка остекления", unit: "м²", price: 350, description: null },
  { id: "f-repair", service_name: "Ремонт кровли", unit: "м²", price: 900, description: null },
  { id: "f-install", service_name: "Монтаж конструкций", unit: "шт", price: 5000, description: null },
];

export default function CalculatorPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [volume, setVolume] = useState("");
  const [urgency, setUrgency] = useState(0);
  const [complexity, setComplexity] = useState(0);
  const [height, setHeight] = useState(0);
  const [season, setSeason] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [usingDb, setUsingDb] = useState(false);
  const [priceLists, setPriceLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedPriceList, setSelectedPriceList] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  // Fetch price lists
  useEffect(() => {
    const fetchPriceLists = async () => {
      const { data } = await supabase
        .from("price_lists")
        .select("id, name")
        .eq("status", "parsed")
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setPriceLists(data);
        setSelectedPriceList(data[0].id);
        setUsingDb(true);
      } else {
        setServices(fallbackServices);
        setUsingDb(false);
      }
      setLoading(false);
    };
    fetchPriceLists();
  }, []);

  // Fetch items when price list changes
  useEffect(() => {
    if (!selectedPriceList) return;
    const fetchItems = async () => {
      const { data } = await supabase
        .from("price_items")
        .select("id, service_name, unit, price, description")
        .eq("price_list_id", selectedPriceList)
        .order("sort_order");

      if (data && data.length > 0) {
        setServices(data);
      } else {
        setServices(fallbackServices);
        setUsingDb(false);
      }
    };
    fetchItems();
  }, [selectedPriceList]);

  const service = services.find((s) => s.id === selectedService);

  const calculation = useMemo(() => {
    if (!service || !volume || Number(volume) <= 0) return null;
    const basePrice = service.price * Number(volume);
    const urgencyCoeff = coeffValues.urgency[urgency];
    const complexityCoeff = coeffValues.complexity[complexity];
    const heightCoeff = coeffValues.height[height];
    const seasonCoeff = coeffValues.season[season];
    const coeff = urgencyCoeff * complexityCoeff * heightCoeff * seasonCoeff;
    let total = Math.round(basePrice * coeff);
    const belowMin = total < MIN_ORDER;
    if (belowMin) total = MIN_ORDER;
    const margin = (total - basePrice) / total;
    const profit = total - basePrice;

    // Recommended price for target margin
    const recommendedPrice = Math.round(basePrice / (1 - TARGET_MARGIN));
    // Minimum acceptable price (at MIN_MARGIN)
    const minAcceptablePrice = Math.round(basePrice / (1 - MIN_MARGIN));
    const minProfit = minAcceptablePrice - basePrice;

    // Smart rating
    let priceRating: "excellent" | "good" | "ok" | "low" | "danger";
    if (margin >= TARGET_MARGIN) priceRating = "excellent";
    else if (margin >= GOOD_MARGIN) priceRating = "good";
    else if (margin >= MIN_MARGIN) priceRating = "ok";
    else if (margin >= 0.1) priceRating = "low";
    else priceRating = "danger";

    return {
      basePrice,
      coeff,
      total,
      margin,
      profit,
      isCheap: margin < MIN_MARGIN,
      belowMin,
      recommendedPrice,
      minAcceptablePrice,
      minProfit,
      priceRating,
      breakdown: {
        urgency: urgencyCoeff,
        complexity: complexityCoeff,
        height: heightCoeff,
        season: seasonCoeff,
      },
    };
  }, [service, volume, urgency, complexity, height, season]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Калькулятор стоимости</h1>
        <p className="text-muted-foreground text-sm mt-1">Быстрый расчёт стоимости высотных работ</p>
      </div>

      {/* Price list selector */}
      {usingDb && priceLists.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-card rounded-xl border border-border p-4"
        >
          <Database className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm text-card-foreground font-medium">Прайс-лист:</span>
          <Select value={selectedPriceList} onValueChange={(v) => { setSelectedPriceList(v); setSelectedService(""); }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priceLists.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{services.length} услуг</span>
        </motion.div>
      )}

      {!usingDb && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Используются стандартные цены. Загрузите PDF прайс-лист для автоматических цен.</span>
        </div>
      )}

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
              <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={servicePickerOpen}
                    className="w-full justify-between font-normal h-10"
                  >
                    {service
                      ? `${service.service_name} — ${service.price.toLocaleString("ru")} ₽/${service.unit}`
                      : "Выберите услугу"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Поиск услуги..." />
                    <CommandList>
                      <CommandEmpty>Услуга не найдена</CommandEmpty>
                      <CommandGroup>
                        {services.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.service_name}
                            onSelect={() => {
                              setSelectedService(s.id);
                              setServicePickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedService === s.id ? "opacity-100" : "opacity-0")} />
                            {s.service_name} — {s.price.toLocaleString("ru")} ₽/{s.unit}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Объём {service ? `(${service.unit})` : ""}</Label>
              <Input
                type="number"
                placeholder="Введите объём"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                min="0"
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
                {/* Service info */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-card-foreground">{service?.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service?.price.toLocaleString("ru")} ₽/{service?.unit} × {volume} {service?.unit}
                  </p>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Базовая стоимость</span>
                  <span className="font-mono">{calculation.basePrice.toLocaleString("ru")} ₽</span>
                </div>

                {/* Coefficient breakdown */}
                <div className="space-y-1.5 border-l-2 border-primary/20 pl-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Коэффициенты</p>
                  {[
                    { label: "Срочность", val: calculation.breakdown.urgency, idx: urgency, labels: coeffLabels.urgency },
                    { label: "Сложность", val: calculation.breakdown.complexity, idx: complexity, labels: coeffLabels.complexity },
                    { label: "Высота", val: calculation.breakdown.height, idx: height, labels: coeffLabels.height },
                    { label: "Сезон", val: calculation.breakdown.season, idx: season, labels: coeffLabels.season },
                  ].map((c) => (
                    <div key={c.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{c.label}: {c.labels[c.idx]}</span>
                      <span className={`font-mono ${c.val > 1 ? "text-warning" : "text-muted-foreground"}`}>
                        ×{c.val}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-muted-foreground font-medium">Итого коэффициент</span>
                    <span className="font-mono text-primary font-semibold">×{calculation.coeff.toFixed(2)}</span>
                  </div>
                </div>

                {calculation.belowMin && (
                  <div className="flex items-center gap-2 text-xs text-info">
                    <Info className="w-3.5 h-3.5" />
                    <span>Применён минимальный заказ {MIN_ORDER.toLocaleString("ru")} ₽</span>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-card-foreground">Итого</span>
                    <span className="text-3xl font-bold font-mono text-gradient">
                      {calculation.total.toLocaleString("ru")} ₽
                    </span>
                  </div>
                </div>

                {/* ─── Smart metrics ──── */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Маржа</p>
                    <p className={`text-lg font-bold font-mono ${
                      calculation.priceRating === "excellent" ? "text-success" :
                      calculation.priceRating === "good" ? "text-success" :
                      calculation.priceRating === "ok" ? "text-warning" :
                      "text-destructive"
                    }`}>
                      {(calculation.margin * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Прибыль</p>
                    <p className={`text-lg font-bold font-mono ${calculation.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {calculation.profit.toLocaleString("ru")} ₽
                    </p>
                  </div>
                </div>

                {/* Price rating indicator */}
                <div className={`rounded-lg p-3 flex items-center gap-2.5 ${
                  calculation.priceRating === "excellent" ? "bg-success/10 border border-success/20" :
                  calculation.priceRating === "good" ? "bg-success/10 border border-success/20" :
                  calculation.priceRating === "ok" ? "bg-warning/10 border border-warning/20" :
                  calculation.priceRating === "low" ? "bg-destructive/10 border border-destructive/20" :
                  "bg-destructive/15 border border-destructive/30"
                }`}>
                  {calculation.priceRating === "excellent" && <ShieldCheck className="w-4 h-4 text-success flex-shrink-0" />}
                  {calculation.priceRating === "good" && <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />}
                  {calculation.priceRating === "ok" && <Target className="w-4 h-4 text-warning flex-shrink-0" />}
                  {(calculation.priceRating === "low" || calculation.priceRating === "danger") && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />}
                  <div>
                    <p className={`text-xs font-semibold ${
                      calculation.priceRating === "excellent" || calculation.priceRating === "good" ? "text-success" :
                      calculation.priceRating === "ok" ? "text-warning" : "text-destructive"
                    }`}>
                      {calculation.priceRating === "excellent" && "Отличная цена"}
                      {calculation.priceRating === "good" && "Хорошая цена"}
                      {calculation.priceRating === "ok" && "Приемлемо, но можно выше"}
                      {calculation.priceRating === "low" && "⚠ Слишком дёшево!"}
                      {calculation.priceRating === "danger" && "🚫 Работа в убыток!"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {calculation.priceRating === "excellent" && `Маржа ${(calculation.margin * 100).toFixed(0)}% — максимальная прибыль`}
                      {calculation.priceRating === "good" && `Маржа ${(calculation.margin * 100).toFixed(0)}% — выше целевой ${(GOOD_MARGIN * 100)}%`}
                      {calculation.priceRating === "ok" && `Маржа ${(calculation.margin * 100).toFixed(0)}% — минимально допустимо`}
                      {calculation.priceRating === "low" && `Маржа ${(calculation.margin * 100).toFixed(0)}% < ${(MIN_MARGIN * 100)}% мин. — повысьте цену`}
                      {calculation.priceRating === "danger" && `Маржа ${(calculation.margin * 100).toFixed(0)}% — вы теряете деньги!`}
                    </p>
                  </div>
                </div>

                {/* Recommended price hint */}
                {calculation.total < calculation.recommendedPrice && (
                  <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
                    <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-card-foreground">Рекомендуемая цена</p>
                      <p className="text-muted-foreground">
                        Для маржи {(TARGET_MARGIN * 100)}% рекомендуем <span className="font-mono font-semibold text-primary">{calculation.recommendedPrice.toLocaleString("ru")} ₽</span>
                      </p>
                      <p className="text-muted-foreground">
                        Минимально: <span className="font-mono">{calculation.minAcceptablePrice.toLocaleString("ru")} ₽</span> (прибыль {calculation.minProfit.toLocaleString("ru")} ₽)
                      </p>
                    </div>
                  </div>
                )}

                <Button className="w-full mt-2 gap-2" size="lg" onClick={() => setShowSendDialog(true)}>
                  <Send className="w-4 h-4" />
                  Отправить клиенту
                </Button>

                {service && calculation && (
                  <SendEstimateDialog
                    open={showSendDialog}
                    onOpenChange={setShowSendDialog}
                    serviceName={service.service_name}
                    unit={service.unit}
                    basePrice={service.price}
                    volume={Number(volume)}
                    coeffUrgency={calculation.breakdown.urgency}
                    coeffComplexity={calculation.breakdown.complexity}
                    coeffHeight={calculation.breakdown.height}
                    coeffSeason={calculation.breakdown.season}
                    totalCoeff={calculation.coeff}
                    totalPrice={calculation.total}
                  />
                )}
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
