import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Clock, FileText, UserX, Bell, ChevronRight, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useState } from "react";

interface SmartNotification {
  id: string;
  type: "overdue" | "unsigned" | "inactive" | "unpaid";
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action?: { label: string; path: string };
  severity: "warning" | "danger" | "info";
}

const severityStyles: Record<string, string> = {
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-warning/30 bg-warning/5 text-warning",
  info: "border-primary/30 bg-primary/5 text-primary",
};

const iconStyles: Record<string, string> = {
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
};

export function SmartNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: orders = [] } = useQuery({
    queryKey: ["notif-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, service_name, status, scheduled_date, payment_status, total_price, paid_amount, created_at")
        .in("status", ["created", "agreed", "in_progress"]);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["notif-estimates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("id, client_name, service_name, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: latestEstimateDate } = useQuery({
    queryKey: ["notif-latest-estimate"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at || null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const notifications = useMemo<SmartNotification[]>(() => {
    const now = new Date();
    const items: SmartNotification[] = [];

    // 1. Overdue orders (scheduled_date passed, not completed)
    orders.forEach((o: any) => {
      if (o.scheduled_date && differenceInDays(now, parseISO(o.scheduled_date)) > 0) {
        const daysLate = differenceInDays(now, parseISO(o.scheduled_date));
        items.push({
          id: `overdue-${o.id}`,
          type: "overdue",
          icon: AlertTriangle,
          title: `Просроченный заказ №${o.order_number}`,
          description: `${o.service_name} — просрочен на ${daysLate} дн.`,
          action: { label: "Открыть заказы", path: "/orders" },
          severity: daysLate > 7 ? "danger" : "warning",
        });
      }
    });

    // 2. Unsigned estimates (pending > 3 days)
    estimates.forEach((e: any) => {
      const days = differenceInDays(now, parseISO(e.created_at));
      if (days >= 3) {
        items.push({
          id: `unsigned-${e.id}`,
          type: "unsigned",
          icon: FileText,
          title: `Клиент не ответил на смету`,
          description: `${e.client_name} — «${e.service_name}» (${days} дн. назад)`,
          action: { label: "Сметы", path: "/orders" },
          severity: days > 7 ? "warning" : "info",
        });
      }
    });

    // 3. Unpaid orders (completed or in_progress with unpaid status)
    orders.forEach((o: any) => {
      if (o.payment_status === "unpaid" && Number(o.total_price) > 0) {
        const days = differenceInDays(now, parseISO(o.created_at));
        if (days > 5) {
          items.push({
            id: `unpaid-${o.id}`,
            type: "unpaid",
            icon: Clock,
            title: `Неоплаченный заказ №${o.order_number}`,
            description: `${o.service_name} — ${Number(o.total_price).toLocaleString("ru")} ₽ не оплачено`,
            action: { label: "Бухгалтерия", path: "/accounting" },
            severity: days > 14 ? "danger" : "warning",
          });
        }
      }
    });

    // 4. Inactivity — no estimates created in 7+ days
    if (latestEstimateDate) {
      const daysSince = differenceInDays(now, parseISO(latestEstimateDate));
      if (daysSince >= 7) {
        items.push({
          id: "inactive-estimates",
          type: "inactive",
          icon: UserX,
          title: "Давно не выставляли сметы",
          description: `Последняя смета — ${formatDistanceToNow(parseISO(latestEstimateDate), { locale: ru, addSuffix: true })}`,
          action: { label: "Калькулятор", path: "/calculator" },
          severity: daysSince > 14 ? "warning" : "info",
        });
      }
    } else if (user) {
      items.push({
        id: "no-estimates",
        type: "inactive",
        icon: UserX,
        title: "Вы ещё не создали ни одной сметы",
        description: "Создайте первую смету в калькуляторе",
        action: { label: "Калькулятор", path: "/calculator" },
        severity: "info",
      });
    }

    return items;
  }, [orders, estimates, latestEstimateDate, user]);

  const visible = notifications.filter((n) => !dismissed.has(n.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Уведомления ({visible.length})
        </span>
      </div>
      <AnimatePresence mode="popLayout">
        {visible.slice(0, 5).map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`relative rounded-lg border p-3 pr-8 ${severityStyles[n.severity]}`}
          >
            <button
              onClick={() => setDismissed((s) => new Set(s).add(n.id))}
              className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-2.5">
              <n.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconStyles[n.severity]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{n.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{n.description}</p>
                {n.action && (
                  <button
                    onClick={() => navigate(n.action!.path)}
                    className="inline-flex items-center gap-1 text-xs font-medium mt-1.5 hover:underline"
                  >
                    {n.action.label}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
