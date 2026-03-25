import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquareText, Phone, Briefcase, Clock, CheckCircle2, XCircle, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  new: { label: "Новая", variant: "default", icon: Clock },
  contacted: { label: "Связался", variant: "secondary", icon: CheckCircle2 },
  declined: { label: "Отклонена", variant: "destructive", icon: XCircle },
};

export default function RequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["contact-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("contact_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
      toast.success("Статус обновлён");
    },
  });

  const filtered = filter === "all" ? requests : requests.filter((r: any) => r.status === filter);
  const newCount = requests.filter((r: any) => r.status === "new").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-primary" /> Заявки от клиентов
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Входящие запросы из маркета альпинистов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Всего</p>
          <p className="text-2xl font-bold text-foreground mt-1">{requests.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Новые</p>
          <p className="text-2xl font-bold text-primary mt-1">{newCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Обработано</p>
          <p className="text-2xl font-bold text-success mt-1">{requests.filter((r: any) => r.status === "contacted").length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "Все" },
          { key: "new", label: `Новые${newCount > 0 ? ` (${newCount})` : ""}` },
          { key: "contacted", label: "Связался" },
          { key: "declined", label: "Отклонённые" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquareText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {filter === "all" ? "Заявок пока нет" : "Нет заявок с таким статусом"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any, i: number) => {
            const cfg = statusConfig[req.status] || statusConfig.new;
            const StatusIcon = cfg.icon;
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-card rounded-xl border p-5 transition-colors ${
                  req.status === "new" ? "border-primary/30 shadow-sm" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-card-foreground">{req.client_name}</h3>
                        <a href={`tel:${req.client_phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {req.client_phone}
                        </a>
                      </div>
                    </div>

                    {req.work_type && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Briefcase className="w-3.5 h-3.5" /> {req.work_type}
                      </div>
                    )}

                    {req.message && (
                      <p className="text-sm text-card-foreground bg-muted/50 rounded-lg p-3">{req.message}</p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(parseISO(req.created_at), { addSuffix: true, locale: ru })}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={cfg.variant} className="gap-1">
                      <StatusIcon className="w-3 h-3" /> {cfg.label}
                    </Badge>

                    {req.status === "new" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="default" className="gap-1 text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: req.id, status: "contacted" })}
                          disabled={updateStatusMutation.isPending}>
                          <CheckCircle2 className="w-3 h-3" /> Связался
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs"
                          onClick={() => updateStatusMutation.mutate({ id: req.id, status: "declined" })}
                          disabled={updateStatusMutation.isPending}>
                          <XCircle className="w-3 h-3" /> Отклонить
                        </Button>
                      </div>
                    )}

                    {req.status !== "new" && (
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => updateStatusMutation.mutate({ id: req.id, status: "new" })}
                        disabled={updateStatusMutation.isPending}>
                        Вернуть
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
