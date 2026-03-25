import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, ChevronRight, Users, Repeat, Calendar,
  Loader2, ArrowRight, Clock, CheckCircle, Briefcase, FileText, Camera, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrderPhotos } from "@/components/OrderPhotos";

const STATUS_FLOW = ["created", "agreed", "in_progress", "done"] as const;
type OrderStatus = typeof STATUS_FLOW[number];

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: typeof Clock }> = {
  created: { label: "Создано", variant: "secondary", icon: FileText },
  agreed: { label: "Согласовано", variant: "outline", icon: CheckCircle },
  in_progress: { label: "В работе", variant: "default", icon: Clock },
  done: { label: "Завершено", variant: "secondary", icon: CheckCircle },
};

type Order = {
  id: string;
  order_number: string;
  service_name: string;
  description: string | null;
  total_price: number;
  status: string;
  volume: number | null;
  unit: string | null;
  client_id: string | null;
  climber_user_id: string | null;
  estimate_id: string | null;
  is_repeat: boolean;
  scheduled_date: string | null;
  completed_date: string | null;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
};

export default function OrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [clientDetailId, setClientDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("orders");
  const [expandedPhotos, setExpandedPhotos] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: "", client_email: "", client_phone: "", client_company: "",
    service_name: "", description: "", total_price: "", volume: "", unit: "м²",
    scheduled_date: "", existing_client_id: "",
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });

  const { data: climbers = [] } = useQuery({
    queryKey: ["climbers-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "climber");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", roles.map((r: any) => r.user_id));
      return profiles || [];
    },
    enabled: !!user,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      let clientId = form.existing_client_id;

      // Create new client if needed
      if (!clientId && form.client_name) {
        // Check if this is a repeat client
        const { data: existingClients } = await supabase
          .from("clients")
          .select("id")
          .eq("name", form.client_name)
          .eq("user_id", user!.id);

        if (existingClients && existingClients.length > 0) {
          clientId = existingClients[0].id;
        } else {
          const { data: newClient, error: cErr } = await supabase
            .from("clients")
            .insert({
              user_id: user!.id,
              name: form.client_name,
              email: form.client_email || null,
              phone: form.client_phone || null,
              company: form.client_company || null,
            })
            .select()
            .single();
          if (cErr) throw cErr;
          clientId = newClient.id;
        }
      }

      // Check if repeat order for this client
      let isRepeat = false;
      if (clientId) {
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId);
        isRepeat = (count || 0) > 0;
      }

      const now = new Date();
      const orderNumber = `ORD-${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(orders.length + 1).padStart(2, "0")}`;

      const { error } = await supabase.from("orders").insert({
        user_id: user!.id,
        client_id: clientId || null,
        order_number: orderNumber,
        service_name: form.service_name,
        description: form.description || null,
        total_price: Number(form.total_price) || 0,
        volume: form.volume ? Number(form.volume) : null,
        unit: form.unit || null,
        scheduled_date: form.scheduled_date || null,
        is_repeat: isRepeat,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setCreateOpen(false);
      setForm({ client_name: "", client_email: "", client_phone: "", client_company: "", service_name: "", description: "", total_price: "", volume: "", unit: "м²", scheduled_date: "", existing_client_id: "" });
      toast.success("Заказ создан");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const update: any = { status: newStatus };
      if (newStatus === "done") update.completed_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("orders").update(update).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Статус обновлён");
    },
  });

  const assignClimberMutation = useMutation({
    mutationFn: async ({ orderId, climberId }: { orderId: string; climberId: string }) => {
      const { error } = await supabase.from("orders").update({ climber_user_id: climberId }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Альпинист назначен");
    },
  });

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const climberMap = new Map(climbers.map((c: any) => [c.user_id, c.full_name]));

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.service_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.client_id && clientMap.get(o.client_id)?.name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const getNextStatus = (current: string): string | null => {
    const idx = STATUS_FLOW.indexOf(current as OrderStatus);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  // Client detail
  const clientOrders = clientDetailId ? orders.filter((o) => o.client_id === clientDetailId) : [];
  const clientDetail = clientDetailId ? clientMap.get(clientDetailId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM & Заказы</h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} заказов, {clients.length} клиентов</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Новый заказ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Новый заказ</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Клиент</Label>
                <Select value={form.existing_client_id} onValueChange={(v) => setForm({ ...form, existing_client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Выберите или создайте нового" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ Новый клиент</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(!form.existing_client_id || form.existing_client_id === "new") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Имя клиента</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                    <div><Label>Компания</Label><Input value={form.client_company} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
                    <div><Label>Телефон</Label><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div><Label>Услуга</Label><Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} placeholder="Мойка фасада" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Объём</Label><Input type="number" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} /></div>
                <div><Label>Ед.</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>Сумма, ₽</Label><Input type="number" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} /></div>
              </div>
              <div><Label>Дата</Label><Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></div>
              <div><Label>Описание</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <Button onClick={() => createOrderMutation.mutate()} disabled={createOrderMutation.isPending || !form.service_name} className="w-full">
                {createOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Создать заказ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Заказы</TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Клиенты</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 mt-4">
          {/* Status pipeline */}
          <div className="grid grid-cols-4 gap-3">
            {STATUS_FLOW.map((s) => {
              const cfg = statusConfig[s];
              const Icon = cfg.icon;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                  className={`bg-card rounded-xl border p-4 text-left transition-all ${statusFilter === s ? "border-primary shadow-sm" : "border-border hover:border-primary/30"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{statusCounts[s] || 0}</p>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по клиенту, услуге или номеру..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Orders table */}
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Нет заказов</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["№", "Дата", "Клиент", "Услуга", "Альпинист", "Сумма", "Статус", ""].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((order, i) => {
                      const client = order.client_id ? clientMap.get(order.client_id) : null;
                      const climberName = order.climber_user_id ? climberMap.get(order.climber_user_id) : null;
                      const nextStatus = getNextStatus(order.status);
                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-mono font-medium text-card-foreground">
                            {order.order_number}
                            {order.is_repeat && <Repeat className="w-3 h-3 text-primary inline ml-1" />}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("ru-RU")}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-card-foreground">
                            {client ? (
                              <button className="hover:text-primary transition-colors" onClick={() => setClientDetailId(client.id)}>
                                {client.name}
                              </button>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{order.service_name}</td>
                          <td className="px-4 py-3">
                            <Select
                              value={order.climber_user_id || "none"}
                              onValueChange={(v) => v !== "none" && assignClimberMutation.mutate({ orderId: order.id, climberId: v })}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue placeholder="Назначить" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Не назначен</SelectItem>
                                {climbers.map((c: any) => (
                                  <SelectItem key={c.user_id} value={c.user_id}>{c.full_name || "—"}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-card-foreground">
                            {Number(order.total_price).toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusConfig[order.status]?.variant || "secondary"}>
                              {statusConfig[order.status]?.label || order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {nextStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => updateStatusMutation.mutate({ orderId: order.id, newStatus: nextStatus })}
                              >
                                <ArrowRight className="w-3 h-3" />
                                {statusConfig[nextStatus].label}
                              </Button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 mt-4">
          {clients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Нет клиентов</p>
              <p className="text-sm mt-1">Клиенты создаются автоматически при создании заказа</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {clients.map((client, i) => {
                const clientOrderCount = orders.filter((o) => o.client_id === client.id).length;
                const clientTotal = orders.filter((o) => o.client_id === client.id).reduce((s, o) => s + Number(o.total_price), 0);
                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setClientDetailId(client.id)}
                    className="bg-card rounded-xl border border-border p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {client.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-card-foreground truncate">{client.name}</h3>
                        {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                      </div>
                      {clientOrderCount > 1 && (
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <Repeat className="w-3 h-3" /> {clientOrderCount}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Заказов</p>
                        <p className="text-sm font-bold text-card-foreground">{clientOrderCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Сумма</p>
                        <p className="text-sm font-bold text-card-foreground">{clientTotal.toLocaleString("ru-RU")} ₽</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Client detail dialog */}
      <Dialog open={!!clientDetailId} onOpenChange={() => setClientDetailId(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          {clientDetail && (
            <>
              <DialogHeader>
                <DialogTitle>История клиента: {clientDetail.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Компания: </span><span className="text-foreground font-medium">{clientDetail.company || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email: </span><span className="text-foreground">{clientDetail.email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Телефон: </span><span className="text-foreground">{clientDetail.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">С: </span><span className="text-foreground">{new Date(clientDetail.created_at).toLocaleDateString("ru-RU")}</span></div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{clientOrders.length} заказов</Badge>
                  <Badge variant="outline">
                    {clientOrders.reduce((s, o) => s + Number(o.total_price), 0).toLocaleString("ru-RU")} ₽ итого
                  </Badge>
                  {clientOrders.length > 1 && <Badge className="gap-1"><Repeat className="w-3 h-3" /> Повторный</Badge>}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Заказы</h3>
                  {clientOrders.map((o) => (
                    <div key={o.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{o.order_number} — {o.service_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ru-RU")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-card-foreground">
                          {Number(o.total_price).toLocaleString("ru-RU")} ₽
                        </span>
                        <Badge variant={statusConfig[o.status]?.variant || "secondary"}>
                          {statusConfig[o.status]?.label || o.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
