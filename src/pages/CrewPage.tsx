import { useState } from "react";
import { motion } from "framer-motion";
import {
  HardHat, Plus, Edit2, Trash2, Save, X, Loader2, Phone, DollarSign,
  Clock, MapPin, ClipboardList, UserCheck, UserX, ChevronDown, ChevronUp,
  Banknote, Calendar,
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

interface WorkerForm {
  name: string;
  phone: string;
  role: string;
  daily_rate: string;
  hourly_rate: string;
  notes: string;
}

const emptyForm: WorkerForm = {
  name: "", phone: "", role: "climber", daily_rate: "", hourly_rate: "", notes: "",
};

const roleLabels: Record<string, string> = {
  climber: "Альпинист",
  helper: "Помощник",
  foreman: "Бригадир",
  driver: "Водитель",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Активен", color: "text-success" },
  inactive: { label: "Неактивен", color: "text-muted-foreground" },
  on_leave: { label: "В отпуске", color: "text-warning" },
};

export default function CrewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("workers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignOrderId, setAssignOrderId] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [assignHours, setAssignHours] = useState("8");
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ worker_id: "", amount: "", period_start: "", period_end: "", payment_method: "cash", notes: "" });
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Queries
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["worker-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_assignments").select("*").order("work_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-for-crew"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, order_number, service_name, status").in("status", ["created", "agreed", "in_progress"]).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: salaryPayments = [] } = useQuery({
    queryKey: ["salary-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("salary_payments").select("*").order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Mutations
  const saveWorkerMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        phone: form.phone || null,
        role: form.role,
        daily_rate: Number(form.daily_rate) || 0,
        hourly_rate: Number(form.hourly_rate) || 0,
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("workers").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.user_id = user!.id;
        const { error } = await supabase.from("workers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success(editingId ? "Работник обновлён" : "Работник добавлен");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Работник удалён");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("workers").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const worker = workers.find((w: any) => w.id === assignWorkerId);
      const { error } = await supabase.from("worker_assignments").insert({
        worker_id: assignWorkerId,
        order_id: assignOrderId,
        user_id: user!.id,
        work_date: assignDate || null,
        hours_worked: Number(assignHours) || 8,
        daily_pay: worker ? Number(worker.daily_rate) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-assignments"] });
      toast.success("Работник назначен на заказ");
      setAssignDialogOpen(false);
      setAssignWorkerId("");
      setAssignOrderId("");
      setAssignDate("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSalaryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salary_payments").insert({
        worker_id: salaryForm.worker_id,
        user_id: user!.id,
        amount: Number(salaryForm.amount),
        period_start: salaryForm.period_start,
        period_end: salaryForm.period_end,
        payment_method: salaryForm.payment_method,
        notes: salaryForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-payments"] });
      toast.success("Выплата зафиксирована");
      setSalaryDialogOpen(false);
      setSalaryForm({ worker_id: "", amount: "", period_start: "", period_end: "", payment_method: "cash", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (w: any) => {
    setEditingId(w.id);
    setForm({ name: w.name, phone: w.phone || "", role: w.role, daily_rate: String(w.daily_rate || ""), hourly_rate: String(w.hourly_rate || ""), notes: w.notes || "" });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); };

  const getWorkerAssignments = (workerId: string) => assignments.filter((a: any) => a.worker_id === workerId);
  const getWorkerSalary = (workerId: string) => salaryPayments.filter((s: any) => s.worker_id === workerId);
  const getWorkerEarned = (workerId: string) => getWorkerAssignments(workerId).reduce((s: number, a: any) => s + Number(a.daily_pay), 0);
  const getWorkerPaid = (workerId: string) => getWorkerSalary(workerId).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const activeWorkers = workers.filter((w: any) => w.status === "active");
  const filtered = workers.filter((w: any) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.phone && w.phone.includes(search))
  );

  const totalEarned = workers.reduce((s: number, w: any) => s + getWorkerEarned(w.id), 0);
  const totalPaid = workers.reduce((s: number, w: any) => s + getWorkerPaid(w.id), 0);

  const orderMap = new Map(orders.map((o: any) => [o.id, o]));

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HardHat className="w-6 h-6 text-primary" /> Бригада
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Управление командой и распределение задач</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAssignDialogOpen(true)} className="gap-2">
            <ClipboardList className="w-4 h-4" /> Назначить
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Добавить
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Всего</p>
          <p className="text-2xl font-bold text-foreground mt-1">{workers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Активных</p>
          <p className="text-2xl font-bold text-primary mt-1">{activeWorkers.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Назначений</p>
          <p className="text-2xl font-bold text-foreground mt-1">{assignments.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Начислено</p>
          <p className="text-2xl font-bold text-warning mt-1">{totalEarned.toLocaleString("ru")} ₽</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Выплачено</p>
          <p className="text-2xl font-bold text-success mt-1">{totalPaid.toLocaleString("ru")} ₽</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="workers" className="gap-1.5"><HardHat className="w-3.5 h-3.5" /> Работники</TabsTrigger>
          <TabsTrigger value="salary" className="gap-1.5"><Banknote className="w-3.5 h-3.5" /> Зарплаты</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4 mt-4">
          <Input placeholder="Поиск по имени или телефону..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <HardHat className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "Не найдено" : "Добавьте первого работника"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w: any, i: number) => {
                const wAssignments = getWorkerAssignments(w.id);
                const earned = getWorkerEarned(w.id);
                const paid = getWorkerPaid(w.id);
                const debt = earned - paid;
                const isExpanded = expandedWorker === w.id;
                const sCfg = statusLabels[w.status] || statusLabels.active;

                return (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                          {w.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-card-foreground">{w.name}</h3>
                            <Badge variant="secondary" className="text-[10px]">{roleLabels[w.role] || w.role}</Badge>
                            <span className={`text-[10px] font-medium ${sCfg.color}`}>● {sCfg.label}</span>
                          </div>
                          {w.phone && (
                            <a href={`tel:${w.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {w.phone}
                            </a>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {w.daily_rate > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {Number(w.daily_rate).toLocaleString("ru")} ₽/день</span>}
                            {w.hourly_rate > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Number(w.hourly_rate).toLocaleString("ru")} ₽/час</span>}
                            <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> {wAssignments.length} назн.</span>
                          </div>
                          {debt > 0 && (
                            <p className="text-xs text-warning mt-1 font-medium">Задолженность: {debt.toLocaleString("ru")} ₽</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {wAssignments.length > 0 && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpandedWorker(isExpanded ? null : w.id)}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleStatusMutation.mutate({ id: w.id, status: w.status })}>
                            {w.status === "active" ? <UserX className="w-4 h-4 text-muted-foreground" /> : <UserCheck className="w-4 h-4 text-success" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(w)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Удалить работника?")) deleteWorkerMutation.mutate(w.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && wAssignments.length > 0 && (
                      <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Назначения</p>
                        {wAssignments.map((a: any) => {
                          const order = orderMap.get(a.order_id);
                          return (
                            <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                {order && <span className="text-xs font-mono text-muted-foreground">{order.order_number}</span>}
                                <span className="text-card-foreground">{order?.service_name || "—"}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                {a.work_date && <span className="text-muted-foreground">{new Date(a.work_date).toLocaleDateString("ru-RU")}</span>}
                                <span className="text-muted-foreground">{a.hours_worked}ч</span>
                                <span className="font-mono font-medium text-card-foreground">{Number(a.daily_pay).toLocaleString("ru")} ₽</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">История выплат зарплат</p>
            <Button onClick={() => setSalaryDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Новая выплата
            </Button>
          </div>

          {salaryPayments.length === 0 ? (
            <div className="text-center py-16">
              <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Выплат пока нет</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Работник", "Период", "Сумма", "Способ", "Дата"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salaryPayments.map((p: any) => {
                    const worker = workers.find((w: any) => w.id === p.worker_id);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium text-card-foreground">{worker?.name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(p.period_start).toLocaleDateString("ru-RU")} — {new Date(p.period_end).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-card-foreground">{Number(p.amount).toLocaleString("ru")} ₽</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.payment_method === "cash" ? "Наличные" : p.payment_method === "card" ? "Карта" : "Перевод"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Salary summary per worker */}
          {workers.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Баланс по работникам</p>
              {workers.map((w: any) => {
                const earned = getWorkerEarned(w.id);
                const paid = getWorkerPaid(w.id);
                const debt = earned - paid;
                return (
                  <div key={w.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-card-foreground font-medium">{w.name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">Начислено: <span className="font-mono">{earned.toLocaleString("ru")} ₽</span></span>
                      <span className="text-muted-foreground">Выплачено: <span className="font-mono">{paid.toLocaleString("ru")} ₽</span></span>
                      <span className={`font-semibold font-mono ${debt > 0 ? "text-warning" : debt < 0 ? "text-success" : "text-muted-foreground"}`}>
                        {debt > 0 ? `Долг: ${debt.toLocaleString("ru")} ₽` : debt < 0 ? `Переплата: ${Math.abs(debt).toLocaleString("ru")} ₽` : "Расчёт: 0 ₽"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Worker dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать работника" : "Новый работник"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Имя *</Label><Input placeholder="Иван Петров" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Телефон</Label><Input placeholder="+7 999 123-45-67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Ставка/день, ₽</Label><Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Ставка/час, ₽</Label><Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Заметки</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button onClick={() => saveWorkerMutation.mutate()} disabled={!form.name || saveWorkerMutation.isPending} className="gap-2">
              {saveWorkerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> {editingId ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Назначить на заказ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Работник</Label>
              <Select value={assignWorkerId} onValueChange={setAssignWorkerId}>
                <SelectTrigger><SelectValue placeholder="Выберите работника" /></SelectTrigger>
                <SelectContent>
                  {activeWorkers.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({roleLabels[w.role]})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Заказ</Label>
              <Select value={assignOrderId} onValueChange={setAssignOrderId}>
                <SelectTrigger><SelectValue placeholder="Выберите заказ" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.order_number} — {o.service_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Дата</Label><Input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Часов</Label><Input type="number" value={assignHours} onChange={(e) => setAssignHours(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Отмена</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={!assignWorkerId || !assignOrderId || assignMutation.isPending} className="gap-2">
              {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Выплата зарплаты</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Работник</Label>
              <Select value={salaryForm.worker_id} onValueChange={(v) => setSalaryForm({ ...salaryForm, worker_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите работника" /></SelectTrigger>
                <SelectContent>
                  {workers.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Сумма, ₽</Label><Input type="number" value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Период с</Label><Input type="date" value={salaryForm.period_start} onChange={(e) => setSalaryForm({ ...salaryForm, period_start: e.target.value })} /></div>
              <div className="space-y-2"><Label>Период по</Label><Input type="date" value={salaryForm.period_end} onChange={(e) => setSalaryForm({ ...salaryForm, period_end: e.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Способ</Label>
              <Select value={salaryForm.payment_method} onValueChange={(v) => setSalaryForm({ ...salaryForm, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="card">Карта</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Комментарий</Label><Input value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>Отмена</Button>
            <Button onClick={() => saveSalaryMutation.mutate()} disabled={!salaryForm.worker_id || !salaryForm.amount || !salaryForm.period_start || !salaryForm.period_end || saveSalaryMutation.isPending} className="gap-2">
              {saveSalaryMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Banknote className="w-4 h-4" /> Зафиксировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
