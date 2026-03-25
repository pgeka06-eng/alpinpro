import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Users, Receipt, SlidersHorizontal, BarChart3, Flag,
  Loader2, Search, MoreHorizontal, Ban, CheckCircle, Trash2, Edit2,
  Save, X, TrendingUp, DollarSign, ClipboardList, Eye, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const roleLabels: Record<string, string> = { admin: "Админ", manager: "Менеджер", climber: "Альпинист" };
const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = { admin: "default", manager: "secondary", climber: "outline" };

export default function AdminPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("analytics");
  const [userSearch, setUserSearch] = useState("");
  const [editingCoeffs, setEditingCoeffs] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<AppRole>("climber");
  const [activityUser, setActivityUser] = useState<any>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  // ─── Queries ────
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["admin-price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_lists").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: priceItems = [] } = useQuery({
    queryKey: ["admin-price-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_items").select("*, price_lists(name)").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["admin-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["admin-estimates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["admin-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ─── Mutations ────
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const existing = userRoles.find((r) => r.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setRoleDialogUser(null);
      toast.success("Роль обновлена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success("Отзыв удалён");
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_blocked: blocked }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success(vars.blocked ? "Пользователь заблокирован" : "Пользователь разблокирован");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Computed analytics ────
  const totalRevenue = payments.reduce((s, p: any) => s + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e: any) => s + Number(e.amount), 0);
  const avgCheck = orders.length > 0 ? Math.round(orders.reduce((s, o: any) => s + Number(o.total_price), 0) / orders.length) : 0;
  const conversionRate = estimates.length > 0 ? ((orders.length / estimates.length) * 100).toFixed(1) : "0";

  // Revenue by day (last 30 days)
  const revenueByDay = (() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MM-dd");
      days[d] = 0;
    }
    payments.forEach((p: any) => {
      const d = format(parseISO(p.payment_date), "MM-dd");
      if (days[d] !== undefined) days[d] += Number(p.amount);
    });
    return Object.entries(days).map(([date, amount]) => ({ date, amount }));
  })();

  // Orders by status
  const ordersByStatus = (() => {
    const counts: Record<string, number> = {};
    orders.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const labels: Record<string, string> = { created: "Создано", agreed: "Согласовано", in_progress: "В работе", completed: "Завершено" };
    return Object.entries(counts).map(([status, count]) => ({ name: labels[status] || status, value: count }));
  })();

  // Filtered users
  const filteredProfiles = profiles.filter((p: any) =>
    !userSearch || (p.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (p.phone || "").includes(userSearch)
  );

  const getUserRole = (userId: string) => {
    const r = userRoles.find((ur: any) => ur.user_id === userId);
    return r ? (r as any).role : null;
  };

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Доступ запрещён</h2>
        <p className="text-muted-foreground text-sm mt-1">Админ-панель доступна только администраторам</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Админ-панель
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Управление системой, пользователями и аналитика</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Аналитика</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Пользователи</TabsTrigger>
          <TabsTrigger value="prices" className="gap-1.5"><Receipt className="w-3.5 h-3.5" /> Прайсы</TabsTrigger>
          <TabsTrigger value="coefficients" className="gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Коэффициенты</TabsTrigger>
          <TabsTrigger value="moderation" className="gap-1.5"><Flag className="w-3.5 h-3.5" /> Модерация</TabsTrigger>
        </TabsList>

        {/* ─── ANALYTICS ──── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: DollarSign, label: "Выручка", value: `${totalRevenue.toLocaleString("ru-RU")} ₽`, color: "text-success" },
              { icon: TrendingUp, label: "Прибыль", value: `${(totalRevenue - totalExpenses).toLocaleString("ru-RU")} ₽`, color: totalRevenue - totalExpenses >= 0 ? "text-success" : "text-destructive" },
              { icon: ClipboardList, label: "Заказы", value: orders.length.toString(), color: "text-primary" },
              { icon: Users, label: "Пользователи", value: profiles.length.toString(), color: "text-primary" },
            ].map((s) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <s.icon className="w-4 h-4" />{s.label}
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Средний чек", value: `${avgCheck.toLocaleString("ru-RU")} ₽` },
              { label: "Конверсия смет→заказы", value: `${conversionRate}%` },
              { label: "Сметы", value: estimates.length },
              { label: "Договоры", value: contracts.length },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Выручка за 30 дней</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByDay}>
                <defs><linearGradient id="aRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient></defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString("ru-RU")} ₽`, "Выручка"]} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#aRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Orders by status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">Заказы по статусам</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">Оплата заказов</h3>
              <div className="space-y-3">
                {[
                  { label: "Оплачено", count: orders.filter((o: any) => o.payment_status === "paid").length, color: "bg-success" },
                  { label: "Частично", count: orders.filter((o: any) => o.payment_status === "partial").length, color: "bg-warning" },
                  { label: "Не оплачено", count: orders.filter((o: any) => o.payment_status === "unpaid").length, color: "bg-destructive" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.color}`} />
                      <span className="text-sm text-card-foreground">{s.label}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold">{s.count}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Всего</span>
                  <span>{orders.length}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── USERS ──── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по имени или телефону..." className="pl-9" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <Badge variant="outline">{profiles.length} пользователей</Badge>
          </div>

          <div className="space-y-2">
            {filteredProfiles.map((p: any) => {
              const userRole = getUserRole(p.user_id);
              const isBlocked = p.is_blocked;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-card rounded-xl border p-4 flex items-center justify-between transition-colors ${isBlocked ? "border-destructive/30 opacity-70" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isBlocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {isBlocked ? <Ban className="w-5 h-5" /> : (p.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-card-foreground">{p.full_name || "Без имени"}</p>
                        {isBlocked && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Заблокирован</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                        {p.city && <span className="text-xs text-muted-foreground">{p.city}</span>}
                        <span className="text-xs text-muted-foreground">{format(parseISO(p.created_at), "dd.MM.yy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {userRole && <Badge variant={roleBadgeVariant[userRole] || "outline"}>{roleLabels[userRole] || userRole}</Badge>}
                    {!userRole && <Badge variant="outline" className="text-muted-foreground">Нет роли</Badge>}
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => setActivityUser(p)}>
                      <Eye className="w-3.5 h-3.5" /> Активность
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setRoleDialogUser(p); setNewRole(userRole || "climber"); }}>
                      <Edit2 className="w-3.5 h-3.5" /> Роль
                    </Button>
                    {p.user_id !== user?.id && (
                      <Button variant="ghost" size="sm"
                        className={`gap-1 ${isBlocked ? "text-success hover:text-success" : "text-destructive hover:text-destructive"}`}
                        onClick={() => toggleBlockMutation.mutate({ userId: p.user_id, blocked: !isBlocked })}
                        disabled={toggleBlockMutation.isPending}>
                        {isBlocked ? <><CheckCircle className="w-3.5 h-3.5" /> Разблокировать</> : <><Ban className="w-3.5 h-3.5" /> Блокировать</>}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {filteredProfiles.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">Пользователи не найдены</p>
            )}
          </div>
        </TabsContent>

        {/* ─── PRICES ──── */}
        <TabsContent value="prices" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Прайс-листов</p>
              <p className="text-2xl font-bold text-foreground mt-1">{priceLists.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Услуг</p>
              <p className="text-2xl font-bold text-foreground mt-1">{priceItems.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Верифицировано</p>
              <p className="text-2xl font-bold text-success mt-1">{priceItems.filter((i: any) => i.is_verified).length}</p>
            </div>
          </div>

          {priceLists.map((pl: any) => {
            const items = priceItems.filter((pi: any) => pi.price_list_id === pl.id);
            return (
              <div key={pl.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{pl.name}</h3>
                    <p className="text-xs text-muted-foreground">{items.length} услуг • {format(parseISO(pl.created_at), "dd.MM.yy")}</p>
                  </div>
                  <Badge variant={pl.status === "parsed" ? "default" : "secondary"}>{pl.status === "parsed" ? "Активен" : pl.status}</Badge>
                </div>
                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        {item.is_verified ? <CheckCircle className="w-3.5 h-3.5 text-success" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                        <span className="text-card-foreground">{item.service_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{item.unit}</span>
                        <span className="font-mono font-semibold">{Number(item.price).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">Нет услуг</p>}
                </div>
              </div>
            );
          })}
          {priceLists.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Нет прайс-листов</p>
            </div>
          )}
        </TabsContent>

        {/* ─── COEFFICIENTS ──── */}
        <TabsContent value="coefficients" className="space-y-4 mt-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Системные коэффициенты</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Настройка множителей для калькулятора</p>
              </div>
              <Badge variant="outline">Только просмотр</Badge>
            </div>

            {[
              { key: "Срочность", labels: ["Обычный ×1.0", "Срочный ×1.3", "Очень срочный ×1.6"], values: [1, 1.3, 1.6] },
              { key: "Сложность", labels: ["Простой ×1.0", "Средний ×1.25", "Сложный ×1.5"], values: [1, 1.25, 1.5] },
              { key: "Высота", labels: ["до 20м ×1.0", "20-50м ×1.2", "50-100м ×1.5", "100м+ ×2.0"], values: [1, 1.2, 1.5, 2.0] },
              { key: "Сезон", labels: ["Лето ×1.0", "Межсезонье ×1.1", "Зима ×1.3"], values: [1, 1.1, 1.3] },
            ].map((coeff) => (
              <div key={coeff.key} className="space-y-2">
                <Label>{coeff.key}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {coeff.labels.map((label, i) => (
                    <div key={i} className={`rounded-lg border p-3 text-center ${coeff.values[i] > 1 ? "border-warning/30 bg-warning/5" : "border-border"}`}>
                      <p className="text-sm text-card-foreground">{label.split(" ×")[0]}</p>
                      <p className={`text-lg font-bold font-mono mt-1 ${coeff.values[i] > 1 ? "text-warning" : "text-muted-foreground"}`}>×{coeff.values[i]}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-card-foreground">Пороги прибыльности</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Минимальная маржа</p>
                  <p className="text-xl font-bold text-destructive mt-1">25%</p>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Целевая маржа</p>
                  <p className="text-xl font-bold text-warning mt-1">40%</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Мин. заказ</p>
                  <p className="text-xl font-bold text-foreground mt-1">15 000 ₽</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── MODERATION ──── */}
        <TabsContent value="moderation" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Отзывы</p>
              <p className="text-2xl font-bold text-foreground mt-1">{reviews.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Ср. рейтинг</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {reviews.length > 0 ? (reviews.reduce((s, r: any) => s + Number(r.rating), 0) / reviews.length).toFixed(1) : "—"}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Ожидают подписи</p>
              <p className="text-2xl font-bold text-foreground mt-1">{estimates.filter((e: any) => e.status === "pending").length}</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-card-foreground mt-2">Отзывы</h3>
          <div className="space-y-2">
            {reviews.map((r: any) => (
              <div key={r.id} className="bg-card rounded-xl border border-border p-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-card-foreground">{r.reviewer_name}</span>
                    <Badge variant="outline">{"⭐".repeat(r.rating)}</Badge>
                    <span className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "dd.MM.yy")}</span>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Качество: {r.quality_score}/5</span>
                    <span>Пунктуальность: {r.punctuality_score}/5</span>
                    <span>Безопасность: {r.safety_score}/5</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Удалить отзыв?")) deleteReviewMutation.mutate(r.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {reviews.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">Нет отзывов для модерации</p>
            )}
          </div>

          <h3 className="text-sm font-semibold text-card-foreground mt-4">Последние сметы (ожидают)</h3>
          <div className="space-y-2">
            {estimates.filter((e: any) => e.status === "pending").slice(0, 10).map((est: any) => (
              <div key={est.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{est.client_name} — {est.service_name}</p>
                  <p className="text-xs text-muted-foreground">{Number(est.total_price).toLocaleString("ru-RU")} ₽ • {format(parseISO(est.created_at), "dd.MM.yy")}</p>
                </div>
                <Badge variant="secondary">Ожидание</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Role change dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={() => setRoleDialogUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
          {roleDialogUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{roleDialogUser.full_name || "Без имени"}</p>
              <div>
                <Label>Роль</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Администратор</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="climber">Альпинист</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => changeRoleMutation.mutate({ userId: roleDialogUser.user_id, newRole })}
                disabled={changeRoleMutation.isPending}>
                {changeRoleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity dialog */}
      <Dialog open={!!activityUser} onOpenChange={() => setActivityUser(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Активность: {activityUser?.full_name || "Без имени"}</DialogTitle></DialogHeader>
          {activityUser && (() => {
            const uid = activityUser.user_id;
            const userOrders = orders.filter((o: any) => o.user_id === uid || o.climber_user_id === uid);
            const userEstimates = estimates.filter((e: any) => e.user_id === uid);
            const userContracts = contracts.filter((c: any) => c.user_id === uid);
            const userPayments = payments.filter((p: any) => p.user_id === uid);
            const userExpenses = expenses.filter((e: any) => e.user_id === uid);
            const totalRev = userPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
            const totalExp = userExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Заказы", value: userOrders.length },
                    { label: "Сметы", value: userEstimates.length },
                    { label: "Договоры", value: userContracts.length },
                    { label: "Доход", value: `${totalRev.toLocaleString("ru-RU")} ₽` },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {userOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Последние заказы</h4>
                    <div className="space-y-1.5">
                      {userOrders.slice(0, 5).map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-card-foreground">{o.service_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">#{o.order_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{Number(o.total_price).toLocaleString("ru-RU")} ₽</span>
                            <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userEstimates.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Последние сметы</h4>
                    <div className="space-y-1.5">
                      {userEstimates.slice(0, 5).map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-card-foreground">{e.client_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{e.service_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{Number(e.total_price).toLocaleString("ru-RU")} ₽</span>
                            <Badge variant={e.status === "signed" ? "default" : "secondary"} className="text-[10px]">{e.status === "signed" ? "Подписана" : "Ожидание"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userOrders.length === 0 && userEstimates.length === 0 && (
                  <p className="text-center py-4 text-sm text-muted-foreground">Нет активности</p>
                )}

                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Регистрация: {format(parseISO(activityUser.created_at), "dd MMMM yyyy", { locale: ru })}
                  {activityUser.is_blocked && <Badge variant="destructive" className="ml-2">Заблокирован</Badge>}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
