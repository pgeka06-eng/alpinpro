import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2,
  Clock, MapPin, HardHat, AlertTriangle, CheckCircle, FileText,
  Users, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, startOfDay, addDays } from "date-fns";
import { ru } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  created: { label: "Создано", color: "bg-secondary text-secondary-foreground", icon: FileText },
  agreed: { label: "Согласовано", color: "bg-info/10 text-info", icon: CheckCircle },
  in_progress: { label: "В работе", color: "bg-primary/10 text-primary", icon: Clock },
  done: { label: "Завершено", color: "bg-success/10 text-success", icon: CheckCircle },
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function PlanningPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["planning-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["planning-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_assignments")
        .select("*, workers(name)")
        .order("work_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["planning-sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const siteMap = useMemo(() => new Map(sites.map((s: any) => [s.id, s.name])), [sites]);

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    // Pad start to Monday
    const firstDayOfWeek = (monthStart.getDay() + 6) % 7; // Monday = 0
    const padStart = Array.from({ length: firstDayOfWeek }, (_, i) =>
      addDays(monthStart, -(firstDayOfWeek - i))
    );
    // Pad end to fill grid
    const totalCells = Math.ceil((padStart.length + days.length) / 7) * 7;
    const padEnd = Array.from(
      { length: totalCells - padStart.length - days.length },
      (_, i) => addDays(monthEnd, i + 1)
    );
    return [...padStart, ...days, ...padEnd];
  }, [monthStart, monthEnd]);

  // Orders by date
  const ordersByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    orders.forEach((o: any) => {
      if (o.scheduled_date) {
        const key = o.scheduled_date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(o);
      }
    });
    return map;
  }, [orders]);

  // Assignments by date
  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    assignments.forEach((a: any) => {
      if (a.work_date) {
        const key = a.work_date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
      }
    });
    return map;
  }, [assignments]);

  // Filtered orders for selected date
  const selectedOrders = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    let result = ordersByDate.get(key) || [];
    if (filterStatus !== "all") result = result.filter((o: any) => o.status === filterStatus);
    return result;
  }, [selectedDate, ordersByDate, filterStatus]);

  const selectedAssignments = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return assignmentsByDate.get(key) || [];
  }, [selectedDate, assignmentsByDate]);

  // Upcoming deadlines (orders with scheduled_date in next 7 days, not done)
  const upcomingDeadlines = useMemo(() => {
    const today = startOfDay(new Date());
    const weekLater = addDays(today, 7);
    return orders.filter((o: any) => {
      if (!o.scheduled_date || o.status === "done") return false;
      const d = new Date(o.scheduled_date);
      return d >= today && d <= weekLater;
    }).sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
  }, [orders]);

  // Overdue orders
  const overdueOrders = useMemo(() => {
    const today = startOfDay(new Date());
    return orders.filter((o: any) => {
      if (!o.scheduled_date || o.status === "done") return false;
      return isBefore(new Date(o.scheduled_date), today);
    });
  }, [orders]);

  // Stats
  const todayOrders = ordersByDate.get(format(new Date(), "yyyy-MM-dd")) || [];
  const inProgressCount = orders.filter((o: any) => o.status === "in_progress").length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" /> Планирование
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Календарь работ и дедлайны</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Сегодня</p>
          <p className="text-2xl font-bold text-primary mt-1">{todayOrders.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">В работе</p>
          <p className="text-2xl font-bold text-foreground mt-1">{inProgressCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Ближ. 7 дней</p>
          <p className="text-2xl font-bold text-info mt-1">{upcomingDeadlines.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Просрочено</p>
          <p className={`text-2xl font-bold mt-1 ${overdueOrders.length > 0 ? "text-destructive" : "text-success"}`}>{overdueOrders.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold text-card-foreground capitalize min-w-[160px] text-center">
                {format(currentMonth, "LLLL yyyy", { locale: ru })}
              </h2>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
              Сегодня
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const key = format(day, "yyyy-MM-dd");
              const dayOrders = ordersByDate.get(key) || [];
              const dayAssignments = assignmentsByDate.get(key) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const hasOverdue = dayOrders.some((o: any) => o.status !== "done" && isBefore(day, startOfDay(new Date())));

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={`relative p-1.5 min-h-[72px] border border-border/30 text-left transition-all hover:bg-muted/50
                    ${!isCurrentMonth ? "opacity-30" : ""}
                    ${isSelected ? "bg-primary/5 ring-2 ring-primary/30" : ""}
                    ${isTodayDate ? "bg-primary/5" : ""}
                  `}
                >
                  <span className={`text-xs font-medium block mb-0.5
                    ${isTodayDate ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-card-foreground"}
                  `}>
                    {format(day, "d")}
                  </span>
                  {dayOrders.length > 0 && (
                    <div className="space-y-0.5">
                      {dayOrders.slice(0, 2).map((o: any) => {
                        const cfg = statusConfig[o.status] || statusConfig.created;
                        return (
                          <div key={o.id} className={`text-[9px] leading-tight truncate rounded px-1 py-0.5 ${cfg.color}`}>
                            {o.service_name}
                          </div>
                        );
                      })}
                      {dayOrders.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{dayOrders.length - 2}</span>
                      )}
                    </div>
                  )}
                  {dayAssignments.length > 0 && dayOrders.length === 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Users className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground">{dayAssignments.length}</span>
                    </div>
                  )}
                  {hasOverdue && (
                    <AlertTriangle className="w-3 h-3 text-destructive absolute top-1 right-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground flex-wrap">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-sm ${cfg.color}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Selected date detail */}
          {selectedDate ? (
            <motion.div
              key={format(selectedDate, "yyyy-MM-dd")}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-xl border border-border p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-card-foreground">
                  {format(selectedDate, "d MMMM, EEEE", { locale: ru })}
                </h3>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrders.length === 0 && selectedAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Нет запланированных работ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedOrders.map((o: any) => {
                    const cfg = statusConfig[o.status] || statusConfig.created;
                    return (
                      <div key={o.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-muted-foreground">{o.order_number}</span>
                          <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-sm font-medium text-card-foreground">{o.service_name}</p>
                        {o.site_id && siteMap.has(o.site_id) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {siteMap.get(o.site_id)}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {o.volume && <span>{o.volume} {o.unit}</span>}
                          <span className="font-mono font-medium text-card-foreground">{Number(o.total_price).toLocaleString("ru")} ₽</span>
                        </div>
                      </div>
                    );
                  })}
                  {selectedAssignments.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <HardHat className="w-3 h-3" /> Бригада на дату
                      </p>
                      {selectedAssignments.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between text-sm py-1">
                          <span className="text-card-foreground">{(a as any).workers?.name || "—"}</span>
                          <span className="text-xs text-muted-foreground">{a.hours_worked}ч · {Number(a.daily_pay).toLocaleString("ru")} ₽</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Eye className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Выберите дату на календаре</p>
            </div>
          )}

          {/* Upcoming deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning" /> Ближайшие дедлайны
              </h3>
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 5).map((o: any) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
                    onClick={() => setSelectedDate(new Date(o.scheduled_date))}
                  >
                    <div>
                      <p className="text-card-foreground font-medium text-xs">{o.service_name}</p>
                      <p className="text-[10px] text-muted-foreground">{o.order_number}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(o.scheduled_date), "d MMM", { locale: ru })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue */}
          {overdueOrders.length > 0 && (
            <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-5">
              <h3 className="font-semibold text-destructive mb-3 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" /> Просроченные
              </h3>
              <div className="space-y-2">
                {overdueOrders.slice(0, 5).map((o: any) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-destructive/10 last:border-0 cursor-pointer hover:bg-destructive/5 rounded px-1 -mx-1"
                    onClick={() => setSelectedDate(new Date(o.scheduled_date))}
                  >
                    <div>
                      <p className="text-card-foreground font-medium text-xs">{o.service_name}</p>
                      <p className="text-[10px] text-muted-foreground">{o.order_number}</p>
                    </div>
                    <span className="text-xs text-destructive whitespace-nowrap">
                      {format(new Date(o.scheduled_date), "d MMM", { locale: ru })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
