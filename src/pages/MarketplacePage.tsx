import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HardHat, Star, Phone, MessageSquare, Shield, MapPin, Briefcase,
  Loader2, Send, Search, Plus, Calendar, DollarSign, Clock,
  ChevronRight, Users, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

// ─── Types ───
interface ClimberProfile {
  user_id: string;
  rating: number;
  reliability: number;
  total_orders: number;
  avg_check: number;
  work_types: string[];
  portfolio_urls: string[];
}

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  description: string | null;
}

const WORK_TYPES = [
  "Мойка фасадов", "Герметизация швов", "Покраска", "Утепление",
  "Монтаж/демонтаж", "Высотная уборка", "Кровельные работы", "Другое",
];

export default function MarketplacePage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>(role === "client" ? "orders" : "climbers");
  const [contactClimber, setContactClimber] = useState<{ userId: string; name: string } | null>(null);
  const [form, setForm] = useState({ client_name: "", client_phone: "", message: "", work_type: "" });
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({
    title: "", description: "", work_type: "Другое", address: "", city: "",
    budget_from: "", budget_to: "", deadline: "",
  });
  const [respondTo, setRespondTo] = useState<any>(null);
  const [responseForm, setResponseForm] = useState({ message: "", proposed_price: "" });

  // ─── Climbers data (existing) ───
  const { data: climbers = [], isLoading: climbersLoading } = useQuery({
    queryKey: ["marketplace-climbers"],
    queryFn: async () => {
      const { data: climberProfiles } = await supabase
        .from("climber_profiles").select("*").order("rating", { ascending: false });
      const userIds = (climberProfiles || []).map((c) => c.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (climberProfiles || [])
        .map((cp) => ({ ...cp, profile: profileMap.get(cp.user_id) || null }))
        .filter((c) => c.profile && !c.profile.is_blocked);
    },
  });

  // ─── Marketplace orders ───
  const { data: marketOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_orders")
        .select("*")
        .order("created_at", { ascending: false });
      // Fetch client profiles
      const clientIds = [...new Set((data || []).map((o: any) => o.client_user_id))];
      if (clientIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, city").in("user_id", clientIds);
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((o: any) => ({ ...o, client_profile: pMap.get(o.client_user_id) }));
    },
    enabled: !!user,
  });

  // ─── My responses (for climbers) ───
  const { data: myResponses = [] } = useQuery({
    queryKey: ["my-marketplace-responses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_responses")
        .select("*")
        .eq("climber_user_id", user!.id);
      return data || [];
    },
    enabled: !!user && role !== "client",
  });

  // ─── Responses to my orders (for clients) ───
  const { data: responsesToMyOrders = [] } = useQuery({
    queryKey: ["responses-to-my-orders"],
    queryFn: async () => {
      const myOrderIds = marketOrders.filter((o: any) => o.client_user_id === user!.id).map((o: any) => o.id);
      if (myOrderIds.length === 0) return [];
      const { data } = await supabase
        .from("marketplace_responses")
        .select("*")
        .in("order_id", myOrderIds);
      // Get climber profiles
      const climberIds = [...new Set((data || []).map((r: any) => r.climber_user_id))];
      if (climberIds.length === 0) return data || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone, city").in("user_id", climberIds);
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((r: any) => ({ ...r, climber_profile: pMap.get(r.climber_user_id) }));
    },
    enabled: !!user && role === "client" && marketOrders.length > 0,
  });

  const respondedOrderIds = new Set(myResponses.map((r: any) => r.order_id));

  // ─── Mutations ───
  const submitContact = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("contact_requests").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заявка отправлена!");
      setContactClimber(null);
      setForm({ client_name: "", client_phone: "", message: "", work_type: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!orderForm.title.trim()) throw new Error("Укажите название заказа");
      const { error } = await supabase.from("marketplace_orders").insert({
        client_user_id: user!.id,
        title: orderForm.title.trim(),
        description: orderForm.description.trim() || null,
        work_type: orderForm.work_type,
        address: orderForm.address.trim() || null,
        city: orderForm.city.trim() || null,
        budget_from: Number(orderForm.budget_from) || 0,
        budget_to: Number(orderForm.budget_to) || 0,
        deadline: orderForm.deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заказ размещён!");
      setShowNewOrder(false);
      setOrderForm({ title: "", description: "", work_type: "Другое", address: "", city: "", budget_from: "", budget_to: "", deadline: "" });
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitResponse = useMutation({
    mutationFn: async () => {
      if (!respondTo) return;
      const { error } = await supabase.from("marketplace_responses").insert({
        order_id: respondTo.id,
        climber_user_id: user!.id,
        message: responseForm.message.trim() || null,
        proposed_price: Number(responseForm.proposed_price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Отклик отправлен!");
      setRespondTo(null);
      setResponseForm({ message: "", proposed_price: "" });
      queryClient.invalidateQueries({ queryKey: ["my-marketplace-responses"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleContact = () => {
    if (!contactClimber || !form.client_name.trim() || !form.client_phone.trim()) {
      toast.error("Укажите имя и телефон");
      return;
    }
    submitContact.mutate({
      climber_user_id: contactClimber.userId,
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim(),
      message: form.message.trim() || null,
      work_type: form.work_type.trim() || null,
    });
  };

  const filtered = climbers.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (c.profile?.full_name || "").toLowerCase();
    const city = (c.profile?.city || "").toLowerCase();
    const types = (c.work_types || []).join(" ").toLowerCase();
    return name.includes(q) || city.includes(q) || types.includes(q);
  });

  const filteredOrders = marketOrders.filter((o: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.title || "").toLowerCase().includes(q) || (o.city || "").toLowerCase().includes(q) || (o.work_type || "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <HardHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-card-foreground">AlpinPro Маркет</h1>
              <p className="text-sm text-muted-foreground">Альпинисты и заказы в одном месте</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="climbers" className="gap-1.5">
                  <Users className="w-4 h-4" /> Альпинисты
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-1.5">
                  <Briefcase className="w-4 h-4" /> Доска заказов
                </TabsTrigger>
              </TabsList>
              {tab === "orders" && user && (
                <Button size="sm" className="gap-1.5" onClick={() => setShowNewOrder(true)}>
                  <Plus className="w-4 h-4" /> Разместить заказ
                </Button>
              )}
            </div>
          </Tabs>

          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={tab === "climbers" ? "Поиск по имени, городу, виду работ..." : "Поиск заказов..."}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* ─── Climbers Tab ─── */}
        {tab === "climbers" && (
          <>
            {climbersLoading ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <HardHat className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Альпинисты не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence>
                  {filtered.map((c: any, i: number) => {
                    const p = c.profile as Profile;
                    return (
                      <motion.div key={c.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all">
                        <div className="p-5 pb-3">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                              {(p?.full_name || "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-semibold text-card-foreground truncate">{p?.full_name || "Альпинист"}</h3>
                              {p?.city && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><MapPin className="w-3 h-3" /> {p.city}</div>}
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-warning fill-warning" /><span className="text-sm font-semibold text-card-foreground">{Number(c.rating).toFixed(1)}</span></div>
                                <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-success" /><span className="text-xs text-muted-foreground">{Math.round(Number(c.reliability))}%</span></div>
                                <div className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-muted-foreground">{c.total_orders} заказов</span></div>
                              </div>
                            </div>
                          </div>
                          {p?.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>}
                          {c.work_types?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {c.work_types.slice(0, 4).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0.5">{t}</Badge>)}
                              {c.work_types.length > 4 && <Badge variant="outline" className="text-[10px] px-2 py-0.5">+{c.work_types.length - 4}</Badge>}
                            </div>
                          )}
                        </div>
                        <div className="border-t border-border p-3 flex gap-2">
                          {p?.phone && <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild><a href={`tel:${p.phone}`}><Phone className="w-3.5 h-3.5" /> Позвонить</a></Button>}
                          <Button size="sm" className="flex-1 gap-1.5" onClick={() => setContactClimber({ userId: c.user_id, name: p?.full_name || "Альпинист" })}>
                            <MessageSquare className="w-3.5 h-3.5" /> Написать
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* ─── Orders Tab ─── */}
        {tab === "orders" && (
          <>
            {ordersLoading ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Заказов пока нет</p>
                {user && <Button className="mt-4 gap-2" onClick={() => setShowNewOrder(true)}><Plus className="w-4 h-4" /> Разместить первый заказ</Button>}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((o: any, i: number) => {
                  const isOwner = o.client_user_id === user?.id;
                  const alreadyResponded = respondedOrderIds.has(o.id);
                  const orderResponses = responsesToMyOrders.filter((r: any) => r.order_id === o.id);

                  return (
                    <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="bg-card rounded-xl border border-border p-5 hover:border-primary/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-card-foreground">{o.title}</h3>
                            <Badge variant="secondary" className="text-[10px]">{o.work_type}</Badge>
                            {isOwner && <Badge className="text-[10px] bg-primary/10 text-primary border-0">Ваш заказ</Badge>}
                          </div>
                          {o.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{o.description}</p>}
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                            {o.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.city}</span>}
                            {(Number(o.budget_from) > 0 || Number(o.budget_to) > 0) && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {Number(o.budget_from) > 0 && Number(o.budget_to) > 0
                                  ? `${Number(o.budget_from).toLocaleString("ru")} – ${Number(o.budget_to).toLocaleString("ru")} ₽`
                                  : `до ${Number(o.budget_to || o.budget_from).toLocaleString("ru")} ₽`}
                              </span>
                            )}
                            {o.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />до {o.deadline}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(parseISO(o.created_at), { locale: ru, addSuffix: true })}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{o.responses_count} откликов</span>
                          </div>
                          {o.client_profile?.full_name && (
                            <p className="text-xs text-muted-foreground mt-2">Заказчик: <span className="font-medium text-card-foreground">{o.client_profile.full_name}</span></p>
                          )}
                        </div>
                        {!isOwner && user && role !== "client" && (
                          <Button
                            size="sm"
                            variant={alreadyResponded ? "outline" : "default"}
                            disabled={alreadyResponded}
                            className="flex-shrink-0 gap-1.5"
                            onClick={() => { setRespondTo(o); setResponseForm({ message: "", proposed_price: "" }); }}
                          >
                            {alreadyResponded ? "Отклик отправлен" : <><Send className="w-3.5 h-3.5" /> Откликнуться</>}
                          </Button>
                        )}
                      </div>

                      {/* Show responses to owner */}
                      {isOwner && orderResponses.length > 0 && (
                        <div className="mt-4 border-t border-border pt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Отклики ({orderResponses.length})</p>
                          {orderResponses.map((r: any) => (
                            <div key={r.id} className="bg-muted/30 rounded-lg p-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-card-foreground">{r.climber_profile?.full_name || "Альпинист"}</p>
                                {r.climber_profile?.city && <p className="text-xs text-muted-foreground">{r.climber_profile.city}</p>}
                                {r.message && <p className="text-xs text-muted-foreground mt-1">{r.message}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {Number(r.proposed_price) > 0 && (
                                  <p className="text-sm font-bold font-mono text-primary">{Number(r.proposed_price).toLocaleString("ru")} ₽</p>
                                )}
                                {r.climber_profile?.phone && (
                                  <Button size="sm" variant="outline" className="mt-1 gap-1 text-xs h-7" asChild>
                                    <a href={`tel:${r.climber_profile.phone}`}><Phone className="w-3 h-3" /> Позвонить</a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Contact Climber Dialog ─── */}
      <Dialog open={!!contactClimber} onOpenChange={() => setContactClimber(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> Заявка — {contactClimber?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Ваше имя *</Label><Input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Иван Петров" className="mt-1" /></div>
            <div><Label>Телефон *</Label><Input value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} placeholder="+7 (999) 123-45-67" className="mt-1" /></div>
            <div><Label>Тип работы</Label><Input value={form.work_type} onChange={(e) => setForm((f) => ({ ...f, work_type: e.target.value }))} placeholder="Мойка фасадов..." className="mt-1" /></div>
            <div><Label>Сообщение</Label><Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Опишите задачу..." className="mt-1" rows={3} /></div>
            <Button className="w-full gap-2" onClick={handleContact} disabled={submitContact.isPending}>
              {submitContact.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitContact.isPending ? "Отправка..." : "Отправить заявку"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── New Order Dialog ─── */}
      <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Новый заказ</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Название заказа *</Label><Input value={orderForm.title} onChange={(e) => setOrderForm((f) => ({ ...f, title: e.target.value }))} placeholder="Мойка фасада 5-этажного дома" className="mt-1" /></div>
            <div><Label>Описание</Label><Textarea value={orderForm.description} onChange={(e) => setOrderForm((f) => ({ ...f, description: e.target.value }))} placeholder="Подробности: площадь, этажность, сроки..." className="mt-1" rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Тип работы</Label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orderForm.work_type} onChange={(e) => setOrderForm((f) => ({ ...f, work_type: e.target.value }))}>
                  {WORK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Город</Label><Input value={orderForm.city} onChange={(e) => setOrderForm((f) => ({ ...f, city: e.target.value }))} placeholder="Москва" className="mt-1" /></div>
            </div>
            <div><Label>Адрес</Label><Input value={orderForm.address} onChange={(e) => setOrderForm((f) => ({ ...f, address: e.target.value }))} placeholder="ул. Пушкина, д. 10" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Бюджет от (₽)</Label><Input type="number" value={orderForm.budget_from} onChange={(e) => setOrderForm((f) => ({ ...f, budget_from: e.target.value }))} placeholder="5000" className="mt-1" /></div>
              <div><Label>Бюджет до (₽)</Label><Input type="number" value={orderForm.budget_to} onChange={(e) => setOrderForm((f) => ({ ...f, budget_to: e.target.value }))} placeholder="15000" className="mt-1" /></div>
            </div>
            <div><Label>Дедлайн</Label><Input type="date" value={orderForm.deadline} onChange={(e) => setOrderForm((f) => ({ ...f, deadline: e.target.value }))} className="mt-1" /></div>
            <Button className="w-full gap-2" onClick={() => createOrder.mutate()} disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Разместить заказ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Respond Dialog ─── */}
      <Dialog open={!!respondTo} onOpenChange={() => setRespondTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Отклик на заказ</DialogTitle></DialogHeader>
          {respondTo && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium text-card-foreground">{respondTo.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{respondTo.work_type} • {respondTo.city || "Без города"}</p>
              </div>
              <div><Label>Ваша цена (₽)</Label><Input type="number" value={responseForm.proposed_price} onChange={(e) => setResponseForm((f) => ({ ...f, proposed_price: e.target.value }))} placeholder="10000" className="mt-1" /></div>
              <div><Label>Сообщение клиенту</Label><Textarea value={responseForm.message} onChange={(e) => setResponseForm((f) => ({ ...f, message: e.target.value }))} placeholder="Готов выполнить, есть опыт в таких работах..." className="mt-1" rows={3} /></div>
              <Button className="w-full gap-2" onClick={() => submitResponse.mutate()} disabled={submitResponse.isPending}>
                {submitResponse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Отправить отклик
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
