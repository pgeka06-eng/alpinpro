import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Edit2, Trash2, Save, Loader2, Phone, Mail, Building2,
  Search, Star, AlertTriangle, UserCheck, Clock, ChevronDown, ChevronUp,
  TrendingUp, DollarSign, FileText, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  company: string;
  status: string;
  notes: string;
}

const emptyForm: ClientForm = {
  name: "", phone: "", email: "", company: "", status: "new", notes: "",
};

const clientStatuses: Record<string, { label: string; color: string; icon: typeof Star }> = {
  new: { label: "Новый", color: "bg-info/10 text-info", icon: Clock },
  regular: { label: "Постоянный", color: "bg-success/10 text-success", icon: Star },
  vip: { label: "VIP", color: "bg-primary/10 text-primary", icon: TrendingUp },
  problem: { label: "Проблемный", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

export default function ClientsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Queries
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["client-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Orders grouped by client
  const ordersByClient = useMemo(() => {
    const map = new Map<string, any[]>();
    orders.forEach((o: any) => {
      if (o.client_id) {
        if (!map.has(o.client_id)) map.set(o.client_id, []);
        map.get(o.client_id)!.push(o);
      }
    });
    return map;
  }, [orders]);

  const getClientOrders = (clientId: string) => ordersByClient.get(clientId) || [];
  const getClientRevenue = (clientId: string) => getClientOrders(clientId).reduce((s: number, o: any) => s + Number(o.total_price), 0);
  const getClientPaid = (clientId: string) => getClientOrders(clientId).reduce((s: number, o: any) => s + Number(o.paid_amount), 0);

  // Mutations
  const saveClientMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.user_id = user!.id;
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editingId ? "Клиент обновлён" : "Клиент добавлен");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Клиент удалён");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("clients").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Статус обновлён");
    },
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name, phone: c.phone || "", email: c.email || "",
      company: c.company || "", status: c.status || "new", notes: c.notes || "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  // Filter & search
  const filtered = useMemo(() => {
    let result = clients;
    if (filterStatus !== "all") result = result.filter((c: any) => c.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q))
      );
    }
    return result;
  }, [clients, filterStatus, search]);

  // Stats
  const totalRevenue = clients.reduce((s: number, c: any) => s + getClientRevenue(c.id), 0);
  const regularCount = clients.filter((c: any) => c.status === "regular" || c.status === "vip").length;
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { new: 0, regular: 0, vip: 0, problem: 0 };
    clients.forEach((c: any) => { counts[c.status || "new"] = (counts[c.status || "new"] || 0) + 1; });
    return counts;
  }, [clients]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Клиенты
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Мини-CRM: клиентская база и история</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Добавить клиента
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Всего</p>
          <p className="text-2xl font-bold text-foreground mt-1">{clients.length}</p>
        </div>
        {Object.entries(clientStatuses).map(([key, cfg]) => (
          <div key={key} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">{cfg.label}</p>
            <p className={`text-2xl font-bold mt-1 ${cfg.color.split(" ")[1]}`}>{statusCounts[key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, телефону, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(clientStatuses).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{search || filterStatus !== "all" ? "Не найдено" : "Добавьте первого клиента"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any, i: number) => {
            const clientOrders = getClientOrders(c.id);
            const revenue = getClientRevenue(c.id);
            const paid = getClientPaid(c.id);
            const isExpanded = expandedClient === c.id;
            const sCfg = clientStatuses[c.status] || clientStatuses.new;
            const lastOrder = clientOrders[0];

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-card-foreground">{c.name}</h3>
                        <Badge variant="secondary" className={`text-[10px] ${sCfg.color}`}>
                          {sCfg.label}
                        </Badge>
                        {c.company && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {c.company}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {c.email}
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {clientOrders.length} заказ(ов)
                        </span>
                        {revenue > 0 && (
                          <span className="flex items-center gap-1 font-mono font-medium text-card-foreground">
                            <DollarSign className="w-3 h-3" /> {revenue.toLocaleString("ru")} ₽
                          </span>
                        )}
                        {lastOrder && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Посл.: {format(new Date(lastOrder.created_at), "d MMM yyyy", { locale: ru })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Status quick change */}
                      <Select
                        value={c.status || "new"}
                        onValueChange={(v) => updateStatusMutation.mutate({ id: c.id, status: v })}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(clientStatuses).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {clientOrders.length > 0 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpandedClient(isExpanded ? null : c.id)}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Удалить клиента?")) deleteClientMutation.mutate(c.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded order history */}
                {isExpanded && clientOrders.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">История заказов</p>
                    {clientOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground">{o.order_number}</span>
                          <span className="text-card-foreground">{o.service_name}</span>
                          <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {format(new Date(o.created_at), "d MMM yyyy", { locale: ru })}
                          </span>
                          <span className="font-mono font-medium text-card-foreground">
                            {Number(o.total_price).toLocaleString("ru")} ₽
                          </span>
                          <Badge variant={o.payment_status === "paid" ? "secondary" : "outline"} className="text-[10px]">
                            {o.payment_status === "paid" ? "Оплачен" : o.payment_status === "partial" ? "Частично" : "Не оплачен"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 text-xs font-medium">
                      <span className="text-muted-foreground">Итого: {clientOrders.length} заказов</span>
                      <div className="flex items-center gap-4">
                        <span className="text-card-foreground">Сумма: <span className="font-mono">{revenue.toLocaleString("ru")} ₽</span></span>
                        <span className="text-success">Оплачено: <span className="font-mono">{paid.toLocaleString("ru")} ₽</span></span>
                        {revenue - paid > 0 && (
                          <span className="text-warning">Долг: <span className="font-mono">{(revenue - paid).toLocaleString("ru")} ₽</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Client dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать клиента" : "Новый клиент"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Имя *</Label>
              <Input placeholder="Иван Петров" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input placeholder="+7 999 123-45-67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="client@mail.ru" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Компания</Label>
                <Input placeholder="ООО Строй" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(clientStatuses).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Заметки</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Примечания по клиенту..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={() => saveClientMutation.mutate()}
              disabled={!form.name.trim() || saveClientMutation.isPending}
              className="gap-2"
            >
              {saveClientMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> {editingId ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
