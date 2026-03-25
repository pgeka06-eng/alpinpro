import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, Send, AlertTriangle, Loader2, Database, Info, TrendingUp,
  ShieldCheck, Lightbulb, Target, ChevronsUpDown, Check, DollarSign, Layers,
  BookmarkPlus, Bookmark, Star, Trash2, Zap, Plus, X, Percent, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SendEstimateDialog } from "@/components/SendEstimateDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ServiceItem {
  id: string;
  service_name: string;
  unit: string;
  price: number;
  description: string | null;
  price_list_name?: string;
}

interface EstimateLine {
  id: string;
  serviceId: string;
  volume: string;
  pickerOpen: boolean;
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

const fallbackServices: ServiceItem[] = [
  { id: "f-wash", service_name: "Мойка фасада", unit: "м²", price: 250, description: null },
  { id: "f-seal", service_name: "Герметизация швов", unit: "п.м.", price: 800, description: null },
  { id: "f-paint", service_name: "Покраска фасада", unit: "м²", price: 450, description: null },
  { id: "f-insulation", service_name: "Утепление фасада", unit: "м²", price: 1200, description: null },
  { id: "f-glass", service_name: "Мойка остекления", unit: "м²", price: 350, description: null },
  { id: "f-repair", service_name: "Ремонт кровли", unit: "м²", price: 900, description: null },
  { id: "f-install", service_name: "Монтаж конструкций", unit: "шт", price: 5000, description: null },
];

let lineCounter = 0;
const newLine = (): EstimateLine => ({ id: `line-${++lineCounter}`, serviceId: "", volume: "", pickerOpen: false });

export default function CalculatorPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [lines, setLines] = useState<EstimateLine[]>([newLine()]);
  const [urgency, setUrgency] = useState(0);
  const [complexity, setComplexity] = useState(0);
  const [height, setHeight] = useState(0);
  const [season, setSeason] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [usingDb, setUsingDb] = useState(false);
  const [priceLists, setPriceLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedPriceList, setSelectedPriceList] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  interface CostData {
    hourly_rate: number;
    material_cost_per_unit: number;
    crew_daily_wage: number;
    crew_size: number;
    equipment_amortization: number;
    transport_cost: number;
    overhead_percent: number;
    hours_per_unit: number;
  }
  const [costSettings, setCostSettings] = useState<CostData | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("cost_settings").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setCostSettings({
          hourly_rate: Number(data.hourly_rate), material_cost_per_unit: Number(data.material_cost_per_unit),
          crew_daily_wage: Number(data.crew_daily_wage), crew_size: Number(data.crew_size),
          equipment_amortization: Number(data.equipment_amortization), transport_cost: Number(data.transport_cost),
          overhead_percent: Number(data.overhead_percent), hours_per_unit: Number(data.hours_per_unit),
        });
      });
  }, [user]);

  useEffect(() => {
    const fetchPriceLists = async () => {
      const { data } = await supabase.from("price_lists").select("id, name").eq("status", "parsed").order("created_at", { ascending: false });
      if (data && data.length > 0) { setPriceLists(data); setSelectedPriceList(data[0].id); setUsingDb(true); }
      else { setServices(fallbackServices); setUsingDb(false); }
      setLoading(false);
    };
    fetchPriceLists();
  }, []);

  useEffect(() => {
    if (!selectedPriceList) return;
    const fetchItems = async () => {
      const { data } = await supabase.from("price_items").select("id, service_name, unit, price, description").eq("price_list_id", selectedPriceList).order("sort_order");
      if (data && data.length > 0) setServices(data);
      else { setServices(fallbackServices); setUsingDb(false); }
    };
    fetchItems();
  }, [selectedPriceList]);

  // Line helpers
  const updateLine = (id: string, patch: Partial<EstimateLine>) => {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
  };
  const removeLine = (id: string) => {
    setLines((prev) => prev.length <= 1 ? prev : prev.filter((l) => l.id !== id));
  };
  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const getService = (serviceId: string) => services.find((s) => s.id === serviceId);

  // Calculation for all lines
  const calculation = useMemo(() => {
    const validLines = lines.filter((l) => l.serviceId && l.volume && Number(l.volume) > 0);
    if (validLines.length === 0) return null;

    const urgencyCoeff = coeffValues.urgency[urgency];
    const complexityCoeff = coeffValues.complexity[complexity];
    const heightCoeff = coeffValues.height[height];
    const seasonCoeff = coeffValues.season[season];
    const coeff = urgencyCoeff * complexityCoeff * heightCoeff * seasonCoeff;

    const lineDetails = validLines.map((l) => {
      const svc = getService(l.serviceId)!;
      const lineBase = svc.price * Number(l.volume);
      const lineTotal = Math.round(lineBase * coeff);
      return { line: l, service: svc, basePrice: lineBase, total: lineTotal, volume: Number(l.volume) };
    });

    const basePrice = lineDetails.reduce((s, d) => s + d.basePrice, 0);
    let total = lineDetails.reduce((s, d) => s + d.total, 0);
    const belowMin = total < MIN_ORDER;
    if (belowMin) total = MIN_ORDER;
    const margin = (total - basePrice) / total;
    const markup = basePrice > 0 ? (total - basePrice) / basePrice : 0;
    const profit = total - basePrice;
    const recommendedPrice = Math.round(basePrice / (1 - TARGET_MARGIN));
    const minAcceptablePrice = Math.round(basePrice / (1 - MIN_MARGIN));
    const minProfit = minAcceptablePrice - basePrice;
    const minProfitAmount = Math.round(basePrice * (MIN_MARGIN / (1 - MIN_MARGIN)));

    let priceRating: "excellent" | "good" | "ok" | "low" | "danger";
    if (margin >= TARGET_MARGIN) priceRating = "excellent";
    else if (margin >= GOOD_MARGIN) priceRating = "good";
    else if (margin >= MIN_MARGIN) priceRating = "ok";
    else if (margin >= 0.1) priceRating = "low";
    else priceRating = "danger";

    return {
      lineDetails, basePrice, coeff, total, margin, markup, profit, isCheap: margin < MIN_MARGIN,
      belowMin, recommendedPrice, minAcceptablePrice, minProfit, minProfitAmount, priceRating,
      breakdown: { urgency: urgencyCoeff, complexity: complexityCoeff, height: heightCoeff, season: seasonCoeff },
    };
  }, [lines, services, urgency, complexity, height, season]);

  // For SendEstimateDialog — use first line's service as primary
  const primaryService = calculation?.lineDetails[0]?.service;
  const totalVolume = calculation?.lineDetails.reduce((s, d) => s + d.volume, 0) || 0;
  const allServicesName = calculation?.lineDetails.map((d) => d.service.service_name).join(" + ") || "";

  // Templates
  const { data: templates = [] } = useQuery({
    queryKey: ["service-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_templates").select("*").order("use_count", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!calculation) throw new Error("Нет данных для сохранения");
      const items = calculation.lineDetails.map((d) => ({
        service_id: d.service.id, service_name: d.service.service_name, unit: d.service.unit, price: d.service.price, volume: d.volume,
      }));
      const { error } = await supabase.from("service_templates").insert({
        user_id: user!.id, name: templateName.trim(), description: templateDesc.trim() || null,
        items, total_base_price: calculation.basePrice,
        coefficients: { urgency, complexity, height, season },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-templates"] });
      toast.success("Шаблон сохранён");
      setSaveTemplateOpen(false); setTemplateName(""); setTemplateDesc("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["service-templates"] }); toast.success("Шаблон удалён"); },
  });

  const applyTemplate = async (tpl: any) => {
    const coeffs = tpl.coefficients as any;
    setUrgency(coeffs.urgency ?? 0);
    setComplexity(coeffs.complexity ?? 0);
    setHeight(coeffs.height ?? 0);
    setSeason(coeffs.season ?? 0);

    const items = tpl.items as any[];
    const newLines: EstimateLine[] = items.map((item: any) => {
      const found = services.find((s) => s.service_name === item.service_name || s.id === item.service_id);
      return { id: `line-${++lineCounter}`, serviceId: found?.id || "", volume: String(item.volume || ""), pickerOpen: false };
    });
    if (newLines.length > 0) setLines(newLines);

    await supabase.from("service_templates").update({ use_count: (tpl.use_count || 0) + 1 }).eq("id", tpl.id);
    queryClient.invalidateQueries({ queryKey: ["service-templates"] });
    toast.success(`Шаблон «${tpl.name}» применён`);
  };

  const toggleFavorite = async (tpl: any) => {
    await supabase.from("service_templates").update({ is_favorite: !tpl.is_favorite }).eq("id", tpl.id);
    queryClient.invalidateQueries({ queryKey: ["service-templates"] });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Калькулятор стоимости</h1>
          <p className="text-muted-foreground text-sm mt-1">Быстрый расчёт стоимости высотных работ</p>
        </div>
        {calculation && (
          <Button variant="outline" className="gap-2" onClick={() => { setTemplateName(allServicesName); setSaveTemplateOpen(true); }}>
            <BookmarkPlus className="w-4 h-4" /> Сохранить шаблон
          </Button>
        )}
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-card-foreground">Шаблоны — 1 клик</span>
            <span className="text-xs text-muted-foreground ml-auto">{templates.length} шаблонов</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {([...templates] as any[])
              .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) || (b.use_count || 0) - (a.use_count || 0))
              .map((tpl: any) => {
                const items = tpl.items as any[];
                const itemSummary = items.map((it: any) => `${it.service_name} ${it.volume}${it.unit}`).join(" + ");
                return (
                  <div key={tpl.id} className="group relative">
                    <button onClick={() => applyTemplate(tpl)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition-all text-left">
                      {tpl.is_favorite && <Star className="w-3 h-3 text-warning fill-warning" />}
                      <div>
                        <p className="text-xs font-medium text-card-foreground">{tpl.name}</p>
                        <p className="text-[10px] text-muted-foreground">{itemSummary}</p>
                        {tpl.total_base_price > 0 && <p className="text-[10px] font-mono text-primary">{Number(tpl.total_base_price).toLocaleString("ru")} ₽</p>}
                      </div>
                    </button>
                    <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                      <button onClick={() => toggleFavorite(tpl)} className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:bg-warning/20">
                        <Star className={`w-2.5 h-2.5 ${tpl.is_favorite ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                      </button>
                      <button onClick={() => { if (confirm("Удалить шаблон?")) deleteTemplateMutation.mutate(tpl.id); }} className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:bg-destructive/20">
                        <Trash2 className="w-2.5 h-2.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Price list selector */}
      {usingDb && priceLists.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-card rounded-xl border border-border p-4">
          <Database className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm text-card-foreground font-medium">Прайс-лист:</span>
          <Select value={selectedPriceList} onValueChange={(v) => { setSelectedPriceList(v); setLines([newLine()]); }}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
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
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 bg-card rounded-xl border border-border p-6 space-y-6">

          {/* Service lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Услуги</Label>
              <Badge variant="secondary" className="text-[10px]">{lines.length} позиц.</Badge>
            </div>

            <AnimatePresence>
              {lines.map((line, idx) => {
                const svc = getService(line.serviceId);
                const lineTotal = svc && line.volume ? svc.price * Number(line.volume) : 0;
                return (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2"
                  >
                    <span className="text-xs text-muted-foreground font-mono mt-3 w-5 flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                      <Popover open={line.pickerOpen} onOpenChange={(open) => updateLine(line.id, { pickerOpen: open })}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 text-xs">
                            {svc ? `${svc.service_name} — ${svc.price.toLocaleString("ru")} ₽/${svc.unit}` : "Выберите услугу"}
                            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Поиск услуги..." />
                            <CommandList>
                              <CommandEmpty>Услуга не найдена</CommandEmpty>
                              <CommandGroup>
                                {services.map((s) => (
                                  <CommandItem key={s.id} value={s.service_name} onSelect={() => { updateLine(line.id, { serviceId: s.id, pickerOpen: false }); }}>
                                    <Check className={cn("mr-2 h-4 w-4", line.serviceId === s.id ? "opacity-100" : "opacity-0")} />
                                    {s.service_name} — {s.price.toLocaleString("ru")} ₽/{s.unit}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          placeholder={svc ? svc.unit : "Объём"}
                          value={line.volume}
                          onChange={(e) => updateLine(line.id, { volume: e.target.value })}
                          min="0"
                          className="h-10"
                        />
                        {svc && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{svc.unit}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {lineTotal > 0 && (
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap min-w-[60px] text-right">
                          {lineTotal.toLocaleString("ru")} ₽
                        </span>
                      )}
                      {lines.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.id)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 w-full border-dashed">
              <Plus className="w-3.5 h-3.5" /> Добавить услугу
            </Button>
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
                  <span className="text-xs font-mono text-primary font-semibold">×{coeffValues[key][val]}</span>
                </div>
                <Slider min={0} max={coeffLabels[key].length - 1} step={1} value={[val]} onValueChange={([v]) => set(v)} />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  {coeffLabels[key].map((l) => <span key={l}>{l}</span>)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Result */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 text-card-foreground">
              <Calculator className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Расчёт</h3>
              {calculation && <Badge variant="secondary" className="text-[10px] ml-auto">{calculation.lineDetails.length} позиц.</Badge>}
            </div>

            {calculation ? (
              <div className="space-y-3">
                {/* Line items */}
                <div className="space-y-1.5">
                  {calculation.lineDetails.map((d, i) => (
                    <div key={d.line.id} className="bg-muted/50 rounded-lg p-2.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-card-foreground">{d.service.service_name}</p>
                        <span className="text-xs font-mono text-card-foreground">{d.total.toLocaleString("ru")} ₽</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {d.service.price.toLocaleString("ru")} ₽/{d.service.unit} × {d.volume} {d.service.unit} × {calculation.coeff.toFixed(2)}
                      </p>
                    </div>
                  ))}
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
                      <span className={`font-mono ${c.val > 1 ? "text-warning" : "text-muted-foreground"}`}>×{c.val}</span>
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
                    <span className="text-3xl font-bold font-mono text-gradient">{calculation.total.toLocaleString("ru")} ₽</span>
                  </div>
                </div>

                {/* Smart metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Маржа</p>
                    <p className={`text-lg font-bold font-mono ${
                      calculation.priceRating === "excellent" || calculation.priceRating === "good" ? "text-success" :
                      calculation.priceRating === "ok" ? "text-warning" : "text-destructive"
                    }`}>{(calculation.margin * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Наценка</p>
                    <p className={`text-lg font-bold font-mono ${
                      calculation.markup >= 0.5 ? "text-success" :
                      calculation.markup >= 0.3 ? "text-warning" : "text-destructive"
                    }`}>{(calculation.markup * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Прибыль</p>
                    <p className={`text-lg font-bold font-mono ${calculation.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {calculation.profit.toLocaleString("ru")} ₽
                    </p>
                  </div>
                </div>

                {/* Min profit threshold */}
                {calculation.profit < calculation.minProfitAmount && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-destructive">Прибыль ниже минимума</p>
                      <p className="text-muted-foreground">
                        Минимальная прибыль при марже {(MIN_MARGIN * 100)}%: <span className="font-mono font-semibold">{calculation.minProfitAmount.toLocaleString("ru")} ₽</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Cost breakdown */}
                {costSettings && (costSettings.hourly_rate > 0 || costSettings.material_cost_per_unit > 0 || costSettings.crew_daily_wage > 0) && (() => {
                  const vol = calculation.lineDetails.reduce((s, d) => s + d.volume, 0);
                  const laborCost = costSettings.hourly_rate * costSettings.hours_per_unit * vol;
                  const materialCost = costSettings.material_cost_per_unit * vol;
                  const workDays = Math.ceil((costSettings.hours_per_unit * vol) / 8);
                  const crewCost = costSettings.crew_daily_wage * workDays;
                  const equipCost = costSettings.equipment_amortization * workDays;
                  const transportCost = costSettings.transport_cost;
                  const subtotal = laborCost + materialCost + crewCost + equipCost + transportCost;
                  const overhead = subtotal * (costSettings.overhead_percent / 100);
                  const totalCost = Math.round(subtotal + overhead);
                  const trueProfit = calculation.total - totalCost;
                  const trueMargin = calculation.total > 0 ? trueProfit / calculation.total : 0;

                  return (
                    <div className="space-y-2 border-2 border-primary/20 rounded-xl p-4 bg-primary/5">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Реальная себестоимость</h4>
                      </div>
                      <div className="space-y-1 text-xs">
                        {laborCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Труд</span><span className="font-mono">{laborCost.toLocaleString("ru")} ₽</span></div>}
                        {materialCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Материалы</span><span className="font-mono">{materialCost.toLocaleString("ru")} ₽</span></div>}
                        {crewCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Бригада ({workDays} дн.)</span><span className="font-mono">{crewCost.toLocaleString("ru")} ₽</span></div>}
                        {equipCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Амортизация</span><span className="font-mono">{equipCost.toLocaleString("ru")} ₽</span></div>}
                        {transportCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Транспорт</span><span className="font-mono">{transportCost.toLocaleString("ru")} ₽</span></div>}
                        {overhead > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Накладные ({costSettings.overhead_percent}%)</span><span className="font-mono">{Math.round(overhead).toLocaleString("ru")} ₽</span></div>}
                        <div className="border-t border-primary/20 pt-1.5 mt-1.5 flex justify-between font-medium">
                          <span className="text-card-foreground">Себестоимость</span>
                          <span className="font-mono text-primary">{totalCost.toLocaleString("ru")} ₽</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className={`rounded-lg p-2.5 text-center ${trueMargin >= 0.25 ? "bg-success/10" : trueMargin >= 0.1 ? "bg-warning/10" : "bg-destructive/10"}`}>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Реальная маржа</p>
                          <p className={`text-lg font-bold font-mono ${trueMargin >= 0.25 ? "text-success" : trueMargin >= 0.1 ? "text-warning" : "text-destructive"}`}>{(trueMargin * 100).toFixed(0)}%</p>
                        </div>
                        <div className={`rounded-lg p-2.5 text-center ${trueProfit >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Чистая прибыль</p>
                          <p className={`text-lg font-bold font-mono ${trueProfit >= 0 ? "text-success" : "text-destructive"}`}>{trueProfit.toLocaleString("ru")} ₽</p>
                        </div>
                      </div>
                      {trueProfit < 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> Работа в убыток! Повысьте цену или снизьте затраты.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!costSettings && (
                  <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3 text-[11px] text-muted-foreground border border-border">
                    <Layers className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Настройте <a href="/settings" className="text-primary hover:underline font-medium">параметры себестоимости</a> чтобы видеть реальную прибыль</span>
                  </div>
                )}

                <div className={`rounded-lg p-3 flex items-center gap-2.5 ${
                  calculation.priceRating === "excellent" || calculation.priceRating === "good" ? "bg-success/10 border border-success/20" :
                  calculation.priceRating === "ok" ? "bg-warning/10 border border-warning/20" :
                  "bg-destructive/10 border border-destructive/20"
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
                  </div>
                </div>

                {calculation.total < calculation.recommendedPrice && (
                  <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1 flex-1">
                        <p className="font-medium text-card-foreground">Рекомендуемая цена</p>
                        <p className="text-muted-foreground">
                          Для маржи {(TARGET_MARGIN * 100)}%: <span className="font-mono font-semibold text-primary">{calculation.recommendedPrice.toLocaleString("ru")} ₽</span>
                          {" "}(наценка {(calculation.basePrice > 0 ? ((calculation.recommendedPrice - calculation.basePrice) / calculation.basePrice * 100).toFixed(0) : 0)}%)
                        </p>
                        <p className="text-muted-foreground">
                          Минимум (маржа {(MIN_MARGIN * 100)}%): <span className="font-mono font-semibold">{calculation.minAcceptablePrice.toLocaleString("ru")} ₽</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button className="w-full mt-2 gap-2" size="lg" onClick={() => setShowSendDialog(true)}>
                  <Send className="w-4 h-4" /> Отправить клиенту
                </Button>

                {primaryService && calculation && (
                  <SendEstimateDialog
                    open={showSendDialog}
                    onOpenChange={setShowSendDialog}
                    serviceName={allServicesName}
                    unit={primaryService.unit}
                    basePrice={calculation.basePrice}
                    volume={totalVolume}
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

      {/* Save template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Сохранить как шаблон</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название шаблона *</Label>
              <Input placeholder='"Швы 100м + герметик + выезд"' value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input placeholder="Очистка крыши стандарт..." value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} />
            </div>
            {calculation && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-xs">
                {calculation.lineDetails.map((d) => (
                  <p key={d.line.id} className="text-muted-foreground">
                    {d.service.service_name}: {d.service.price.toLocaleString("ru")} ₽/{d.service.unit} × {d.volume} {d.service.unit}
                  </p>
                ))}
                <p className="font-mono font-semibold text-primary pt-1 border-t border-border">Итого: {calculation.total.toLocaleString("ru")} ₽</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Отмена</Button>
            <Button onClick={() => saveTemplateMutation.mutate()} disabled={!templateName.trim() || saveTemplateMutation.isPending} className="gap-2">
              {saveTemplateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Bookmark className="w-4 h-4" /> Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
