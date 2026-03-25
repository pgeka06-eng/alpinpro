import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, User, Building2, Bell, DollarSign, Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CostSettings {
  hourly_rate: number;
  material_cost_per_unit: number;
  crew_daily_wage: number;
  crew_size: number;
  equipment_amortization: number;
  transport_cost: number;
  overhead_percent: number;
  hours_per_unit: number;
}

const defaultCosts: CostSettings = {
  hourly_rate: 0,
  material_cost_per_unit: 0,
  crew_daily_wage: 0,
  crew_size: 2,
  equipment_amortization: 0,
  transport_cost: 0,
  overhead_percent: 10,
  hours_per_unit: 0.5,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [costs, setCosts] = useState<CostSettings>(defaultCosts);
  const [costsSaving, setCostsSaving] = useState(false);
  const [costsLoaded, setCostsLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("cost_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setCosts({
          hourly_rate: Number(data.hourly_rate),
          material_cost_per_unit: Number(data.material_cost_per_unit),
          crew_daily_wage: Number(data.crew_daily_wage),
          crew_size: Number(data.crew_size),
          equipment_amortization: Number(data.equipment_amortization),
          transport_cost: Number(data.transport_cost),
          overhead_percent: Number(data.overhead_percent),
          hours_per_unit: Number(data.hours_per_unit),
        });
      }
      setCostsLoaded(true);
    };
    load();
  }, [user]);

  const saveCosts = async () => {
    if (!user) return;
    setCostsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("cost_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cost_settings")
          .update(costs)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cost_settings")
          .insert({ ...costs, user_id: user.id });
        if (error) throw error;
      }
      toast.success("Параметры себестоимости сохранены");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCostsSaving(false);
    }
  };

  const costFields: { key: keyof CostSettings; label: string; desc: string; unit: string; step?: string }[] = [
    { key: "hourly_rate", label: "Стоимость часа работы", desc: "Сколько стоит 1 час работы альпиниста", unit: "₽/час" },
    { key: "hours_per_unit", label: "Часов на ед. объёма", desc: "Сколько часов уходит на 1 м²/п.м./шт", unit: "час", step: "0.1" },
    { key: "material_cost_per_unit", label: "Материалы на ед. объёма", desc: "Расходные материалы на 1 м²/п.м./шт", unit: "₽/ед" },
    { key: "crew_daily_wage", label: "Зарплата бригады в день", desc: "Общая дневная зарплата бригады", unit: "₽/день" },
    { key: "crew_size", label: "Размер бригады", desc: "Количество человек в бригаде", unit: "чел", step: "1" },
    { key: "equipment_amortization", label: "Амортизация снаряжения", desc: "Износ оборудования за день работы", unit: "₽/день" },
    { key: "transport_cost", label: "Транспорт", desc: "Расходы на выезд на объект", unit: "₽/выезд" },
    { key: "overhead_percent", label: "Накладные расходы", desc: "Процент общих расходов (связь, аренда, налоги)", unit: "%", step: "1" },
  ];

  // Preview calculation
  const exampleVolume = 100;
  const laborCost = costs.hourly_rate * costs.hours_per_unit * exampleVolume;
  const materialCost = costs.material_cost_per_unit * exampleVolume;
  const workDays = Math.ceil((costs.hours_per_unit * exampleVolume) / 8);
  const crewCost = costs.crew_daily_wage * workDays;
  const equipCost = costs.equipment_amortization * workDays;
  const transportTotal = costs.transport_cost;
  const subtotal = laborCost + materialCost + crewCost + equipCost + transportTotal;
  const overhead = subtotal * (costs.overhead_percent / 100);
  const totalCost = subtotal + overhead;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">Управление профилем и параметрами</p>
      </div>

      {/* Cost Settings — prominent position */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border-2 border-primary/20 p-6 space-y-5">
        <div className="flex items-center gap-2 text-card-foreground">
          <DollarSign className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Себестоимость работ</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto font-medium">Важно</span>
        </div>

        <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Заполните параметры себестоимости — калькулятор автоматически покажет реальную прибыль, а не просто маржу от прайс-цены.</span>
        </div>

        {costsLoaded ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {costFields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step={f.step || "1"}
                      min="0"
                      value={costs[f.key] || ""}
                      onChange={(e) => setCosts({ ...costs, [f.key]: Number(e.target.value) || 0 })}
                      className="pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Live preview */}
            {totalCost > 0 && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 border border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Пример: себестоимость на {exampleVolume} м²
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {laborCost > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Труд</span>
                      <p className="font-mono font-medium text-card-foreground">{laborCost.toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                  {materialCost > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Материалы</span>
                      <p className="font-mono font-medium text-card-foreground">{materialCost.toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                  {crewCost > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Бригада ({workDays} дн.)</span>
                      <p className="font-mono font-medium text-card-foreground">{crewCost.toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                  {equipCost > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Снаряжение</span>
                      <p className="font-mono font-medium text-card-foreground">{equipCost.toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                  {transportTotal > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Транспорт</span>
                      <p className="font-mono font-medium text-card-foreground">{transportTotal.toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                  {overhead > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Накладные ({costs.overhead_percent}%)</span>
                      <p className="font-mono font-medium text-card-foreground">{Math.round(overhead).toLocaleString("ru")} ₽</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium text-card-foreground">Итого себестоимость</span>
                  <span className="text-lg font-bold font-mono text-primary">{Math.round(totalCost).toLocaleString("ru")} ₽</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  На 1 м²: ~{Math.round(totalCost / exampleVolume).toLocaleString("ru")} ₽
                </p>
              </div>
            )}

            <Button onClick={saveCosts} disabled={costsSaving} className="gap-2">
              {costsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить себестоимость
            </Button>
          </>
        ) : (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 text-card-foreground">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Профиль</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input placeholder="Ваше имя" defaultValue="Алексей Иванов" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="email@example.com" defaultValue="alex@alpinpro.ru" />
          </div>
          <div className="space-y-2">
            <Label>Телефон</Label>
            <Input placeholder="+7 (999) 999-99-99" defaultValue="+7 (903) 555-12-34" />
          </div>
          <div className="space-y-2">
            <Label>Город</Label>
            <Input placeholder="Москва" defaultValue="Москва" />
          </div>
        </div>
        <Button>Сохранить</Button>
      </motion.div>

      {/* Company */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 text-card-foreground">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Компания</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input defaultValue="ООО АльпинПро" />
          </div>
          <div className="space-y-2">
            <Label>ИНН</Label>
            <Input defaultValue="7712345678" />
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 text-card-foreground">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Уведомления</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: "Новые заказы", desc: "Уведомления о новых заказах" },
            { label: "Статус заказа", desc: "Изменения статусов заказов" },
            { label: "Оплаты", desc: "Уведомления об оплатах" },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
