import { motion } from "framer-motion";
import { Settings, User, Building2, CreditCard, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">Управление профилем и параметрами</p>
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border border-border p-6 space-y-5">
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
