import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HardHat, Star, Phone, MessageSquare, Shield, MapPin, Briefcase,
  CheckCircle2, Loader2, Send, X, Search,
} from "lucide-react";
import { toast } from "sonner";

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

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [contactClimber, setContactClimber] = useState<{ userId: string; name: string } | null>(null);
  const [form, setForm] = useState({ client_name: "", client_phone: "", message: "", work_type: "" });

  const { data: climbers = [], isLoading } = useQuery({
    queryKey: ["marketplace-climbers"],
    queryFn: async () => {
      const { data: climberProfiles, error: cpError } = await supabase
        .from("climber_profiles")
        .select("*")
        .order("rating", { ascending: false });
      if (cpError) throw cpError;

      const userIds = (climberProfiles || []).map((c) => c.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);
      if (pError) throw pError;

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      return (climberProfiles || [])
        .map((cp) => ({
          ...cp,
          profile: profileMap.get(cp.user_id) || null,
        }))
        .filter((c) => c.profile && !c.profile.is_blocked);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { climber_user_id: string; client_name: string; client_phone: string; message: string; work_type: string }) => {
      const { error } = await supabase.from("contact_requests").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заявка отправлена! Альпинист свяжется с вами.");
      setContactClimber(null);
      setForm({ client_name: "", client_phone: "", message: "", work_type: "" });
    },
    onError: (e: Error) => toast.error("Ошибка: " + e.message),
  });

  const handleSubmit = () => {
    if (!contactClimber) return;
    if (!form.client_name.trim() || !form.client_phone.trim()) {
      toast.error("Укажите имя и телефон");
      return;
    }
    submitMutation.mutate({
      climber_user_id: contactClimber.userId,
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim(),
      message: form.message.trim() || null as any,
      work_type: form.work_type.trim() || null as any,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <HardHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-card-foreground">AlpinPro Маркет</h1>
              <p className="text-sm text-muted-foreground">Найдите проверенного промышленного альпиниста</p>
            </div>
          </div>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени, городу, виду работ..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Загрузка...</p>
          </div>
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
                  <motion.div
                    key={c.user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
                  >
                    {/* Top section */}
                    <div className="p-5 pb-3">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                          {(p?.full_name || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-card-foreground truncate">
                            {p?.full_name || "Альпинист"}
                          </h3>
                          {p?.city && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3" /> {p.city}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                              <span className="text-sm font-semibold text-card-foreground">{Number(c.rating).toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-success" />
                              <span className="text-xs text-muted-foreground">{Math.round(Number(c.reliability))}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs text-muted-foreground">{c.total_orders} заказов</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {p?.description && (
                        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
                      )}

                      {c.work_types && c.work_types.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {c.work_types.slice(0, 4).map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0.5">{t}</Badge>
                          ))}
                          {c.work_types.length > 4 && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">+{c.work_types.length - 4}</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-border p-3 flex gap-2">
                      {p?.phone && (
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                          <a href={`tel:${p.phone}`}>
                            <Phone className="w-3.5 h-3.5" /> Позвонить
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => setContactClimber({ userId: c.user_id, name: p?.full_name || "Альпинист" })}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Написать
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Contact Dialog */}
      <Dialog open={!!contactClimber} onOpenChange={() => setContactClimber(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Заявка — {contactClimber?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground">Ваше имя *</label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                placeholder="Иван Петров"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Телефон *</label>
              <Input
                value={form.client_phone}
                onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                placeholder="+7 (999) 123-45-67"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Тип работы</label>
              <Input
                value={form.work_type}
                onChange={(e) => setForm((f) => ({ ...f, work_type: e.target.value }))}
                placeholder="Мойка фасадов, герметизация швов..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Сообщение</label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Опишите задачу, адрес, сроки..."
                className="mt-1"
                rows={3}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitMutation.isPending ? "Отправка..." : "Отправить заявку"}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Альпинист получит вашу заявку и свяжется с вами
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
