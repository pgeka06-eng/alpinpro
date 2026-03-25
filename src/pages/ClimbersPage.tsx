import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, MapPin, Briefcase, TrendingUp, Shield, Camera, Plus,
  ChevronLeft, Image, Loader2, Edit2, Check, MessageSquare,
  ShieldCheck, Zap, Clock, HardHat
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ClimberProfile = {
  id: string;
  user_id: string;
  work_types: string[];
  portfolio_urls: string[];
  total_orders: number;
  rating: number;
  avg_check: number;
  reliability: number;
};

type Profile = {
  user_id: string;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  description: string | null;
  avatar_url: string | null;
};

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  quality_score: number;
  punctuality_score: number;
  safety_score: number;
  comment: string | null;
  created_at: string;
};

type ClimberWithProfile = ClimberProfile & { profile: Profile };

const WORK_TYPE_OPTIONS = [
  "Мойка фасадов", "Покраска", "Герметизация", "Утепление",
  "Монтаж", "Ремонт кровли", "Мойка остекления", "Демонтаж",
  "Монтаж рекламы", "Высотный клининг",
];

function StarRating({ value, onChange, size = 4 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-${size} h-${size} ${s <= value ? "text-primary fill-primary" : "text-muted-foreground/30"} ${onChange ? "cursor-pointer" : ""}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );
}

function TrustIndex({ value }: { value: number }) {
  const color = value >= 80 ? "text-green-600" : value >= 50 ? "text-yellow-600" : "text-red-500";
  const bgColor = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  const label = value >= 80 ? "Высокий" : value >= 50 ? "Средний" : "Низкий";
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Индекс доверия</h3>
      </div>
      <div className="flex items-end gap-3 mb-2">
        <span className={`text-3xl font-bold ${color}`}>{value}</span>
        <span className="text-sm text-muted-foreground mb-1">/ 100</span>
        <Badge variant="outline" className={`ml-auto ${color}`}>{label}</Badge>
      </div>
      <Progress value={value} className={`h-2 [&>div]:${bgColor}`} />
      <p className="text-xs text-muted-foreground mt-2">
        На основе качества, пунктуальности и безопасности работ
      </p>
    </div>
  );
}

export default function ClimbersPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClimber, setSelectedClimber] = useState<ClimberWithProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    reviewer_name: "", rating: 5, quality_score: 5, punctuality_score: 5, safety_score: 5, comment: "",
  });

  const { data: climbers = [], isLoading } = useQuery({
    queryKey: ["climbers"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
      if (pErr) throw pErr;
      const { data: climberProfiles, error: cErr } = await supabase.from("climber_profiles").select("*");
      if (cErr) throw cErr;
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "climber");
      const climberUserIds = new Set((roles || []).map((r: any) => r.user_id));
      const cpMap = new Map((climberProfiles || []).map((cp: any) => [cp.user_id, cp]));

      return (profiles || [])
        .filter((p: any) => climberUserIds.has(p.user_id))
        .map((p: any): ClimberWithProfile => {
          const cp = cpMap.get(p.user_id) as ClimberProfile | undefined;
          return {
            id: cp?.id || "", user_id: p.user_id,
            work_types: cp?.work_types || [], portfolio_urls: cp?.portfolio_urls || [],
            total_orders: cp?.total_orders || 0, rating: cp?.rating || 0,
            avg_check: cp?.avg_check || 0, reliability: cp?.reliability || 0,
            profile: p as Profile,
          };
        });
    },
    enabled: !!user,
  });

  // Reviews for selected climber
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", selectedClimber?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("climber_user_id", selectedClimber!.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
    enabled: !!selectedClimber,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClimber) return;
      const { error } = await supabase.from("reviews").insert({
        climber_user_id: selectedClimber.user_id,
        reviewer_name: reviewForm.reviewer_name,
        rating: reviewForm.rating,
        quality_score: reviewForm.quality_score,
        punctuality_score: reviewForm.punctuality_score,
        safety_score: reviewForm.safety_score,
        comment: reviewForm.comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["climbers"] });
      setShowReviewForm(false);
      setReviewForm({ reviewer_name: "", rating: 5, quality_score: 5, punctuality_score: 5, safety_score: 5, comment: "" });
      toast.success("Отзыв добавлен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClimber) return;
      const ext = file.name.split(".").pop();
      const path = `avatars/${selectedClimber.user_id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("climber-files").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("climber-files").getPublicUrl(path);
      const { error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", selectedClimber.user_id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["climbers"] }); toast.success("Фото обновлено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPortfolioMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClimber) return;
      const path = `portfolio/${selectedClimber.user_id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("climber-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("climber-files").getPublicUrl(path);
      const newUrls = [...(selectedClimber.portfolio_urls || []), urlData.publicUrl];
      if (selectedClimber.id) {
        await supabase.from("climber_profiles").update({ portfolio_urls: newUrls }).eq("id", selectedClimber.id);
      } else {
        await supabase.from("climber_profiles").insert({ user_id: selectedClimber.user_id, portfolio_urls: newUrls });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["climbers"] }); toast.success("Фото добавлено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { description?: string; city?: string; work_types?: string[] }) => {
      if (!selectedClimber) return;
      if (data.description !== undefined || data.city !== undefined) {
        await supabase.from("profiles").update({ description: data.description, city: data.city }).eq("user_id", selectedClimber.user_id);
      }
      if (data.work_types) {
        if (selectedClimber.id) {
          await supabase.from("climber_profiles").update({ work_types: data.work_types }).eq("id", selectedClimber.id);
        } else {
          await supabase.from("climber_profiles").insert({ user_id: selectedClimber.user_id, work_types: data.work_types });
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["climbers"] }); setEditMode(false); toast.success("Профиль обновлён"); },
  });

  const [editDescription, setEditDescription] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editWorkTypes, setEditWorkTypes] = useState<string[]>([]);

  const openEdit = (c: ClimberWithProfile) => {
    setEditDescription(c.profile.description || "");
    setEditCity(c.profile.city || "");
    setEditWorkTypes(c.work_types || []);
    setEditMode(true);
  };

  const canEdit = (c: ClimberWithProfile) => user?.id === c.user_id || role === "admin";

  // Compute sub-score averages from reviews
  const avgScores = reviews.length > 0 ? {
    quality: reviews.reduce((s, r) => s + r.quality_score, 0) / reviews.length,
    punctuality: reviews.reduce((s, r) => s + r.punctuality_score, 0) / reviews.length,
    safety: reviews.reduce((s, r) => s + r.safety_score, 0) / reviews.length,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Альпинисты</h1>
          <p className="text-muted-foreground text-sm mt-1">Профили, портфолио и метрики</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : climbers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет альпинистов</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {climbers.map((c, i) => (
            <motion.div
              key={c.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedClimber(c); setShowReviewForm(false); }}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4">
                {c.profile.avatar_url ? (
                  <img src={c.profile.avatar_url} alt={c.profile.full_name || ""} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                    {(c.profile.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-card-foreground truncate">{c.profile.full_name || "Без имени"}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <MapPin className="w-3.5 h-3.5" /><span>{c.profile.city || "—"}</span>
                  </div>
                </div>
                {c.rating > 0 && (
                  <div className="flex items-center gap-1 bg-accent px-2 py-1 rounded-md">
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <span className="text-sm font-semibold text-accent-foreground">{c.rating}</span>
                  </div>
                )}
              </div>
              {c.work_types.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {c.work_types.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>
                  ))}
                  {c.work_types.length > 3 && <Badge variant="outline" className="text-[11px]">+{c.work_types.length - 3}</Badge>}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <Briefcase className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-bold font-mono text-card-foreground">{c.total_orders}</p>
                  <p className="text-[10px] text-muted-foreground">заказов</p>
                </div>
                <div className="text-center">
                  <Star className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-bold font-mono text-card-foreground">{c.rating > 0 ? c.rating : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">рейтинг</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-bold font-mono text-card-foreground">{c.avg_check > 0 ? `${(c.avg_check / 1000).toFixed(0)}к` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">ср. чек</p>
                </div>
                <div className="text-center">
                  <ShieldCheck className="w-3 h-3 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-bold font-mono text-card-foreground">{c.reliability > 0 ? `${c.reliability}%` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">доверие</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      <Dialog open={!!selectedClimber} onOpenChange={() => { setSelectedClimber(null); setEditMode(false); setShowReviewForm(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClimber && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  Профиль альпиниста
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-2">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    {selectedClimber.profile.avatar_url ? (
                      <img src={selectedClimber.profile.avatar_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
                        {(selectedClimber.profile.full_name || "?")[0]}
                      </div>
                    )}
                    {canEdit(selectedClimber) && (
                      <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatarMutation.mutate(f); }} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-foreground">{selectedClimber.profile.full_name || "Без имени"}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" /> {selectedClimber.profile.city || "Не указан"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedClimber.profile.description || "Описание не заполнено"}</p>
                  </div>
                  {canEdit(selectedClimber) && !editMode && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedClimber)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Ред.
                    </Button>
                  )}
                </div>

                {/* Edit form */}
                <AnimatePresence>
                  {editMode && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-muted/50 rounded-xl p-4 space-y-3">
                      <div><Label>Город</Label><Input value={editCity} onChange={(e) => setEditCity(e.target.value)} /></div>
                      <div><Label>Описание</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></div>
                      <div>
                        <Label>Типы работ</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {WORK_TYPE_OPTIONS.map((wt) => (
                            <Badge key={wt} variant={editWorkTypes.includes(wt) ? "default" : "outline"} className="cursor-pointer" onClick={() => setEditWorkTypes((prev) => prev.includes(wt) ? prev.filter((x) => x !== wt) : [...prev, wt])}>
                              {wt}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateProfileMutation.mutate({ description: editDescription, city: editCity, work_types: editWorkTypes })} disabled={updateProfileMutation.isPending}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Сохранить
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Отмена</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Trust Index */}
                {selectedClimber.reliability > 0 && (
                  <TrustIndex value={selectedClimber.reliability} />
                )}

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: Briefcase, label: "Заказов", value: selectedClimber.total_orders },
                    { icon: Star, label: "Рейтинг", value: selectedClimber.rating || "—" },
                    { icon: TrendingUp, label: "Ср. чек", value: selectedClimber.avg_check > 0 ? `${(selectedClimber.avg_check / 1000).toFixed(0)}к ₽` : "—" },
                    { icon: ShieldCheck, label: "Доверие", value: selectedClimber.reliability > 0 ? `${selectedClimber.reliability}%` : "—" },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/50 rounded-lg p-3 text-center">
                      <m.icon className="w-4 h-4 mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold text-foreground">{m.value}</p>
                      <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sub-scores breakdown */}
                {avgScores && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: HardHat, label: "Качество", value: avgScores.quality },
                      { icon: Clock, label: "Пунктуальность", value: avgScores.punctuality },
                      { icon: Zap, label: "Безопасность", value: avgScores.safety },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{s.value.toFixed(1)}</span>
                          <StarRating value={Math.round(s.value)} size={3} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Work types */}
                {selectedClimber.work_types.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Типы работ</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedClimber.work_types.map((wt) => (<Badge key={wt} variant="secondary">{wt}</Badge>))}
                    </div>
                  </div>
                )}

                {/* Portfolio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Портфолио</h3>
                    {canEdit(selectedClimber) && (
                      <Button variant="outline" size="sm" onClick={() => portfolioInputRef.current?.click()}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
                      </Button>
                    )}
                    <input ref={portfolioInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPortfolioMutation.mutate(f); }} />
                  </div>
                  {selectedClimber.portfolio_urls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedClimber.portfolio_urls.map((url, idx) => (
                        <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-muted">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
                      <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Пока нет фотографий</p>
                    </div>
                  )}
                </div>

                {/* Reviews */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Отзывы ({reviews.length})
                    </h3>
                    {!showReviewForm && (
                      <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Оставить отзыв
                      </Button>
                    )}
                  </div>

                  {/* Review form */}
                  <AnimatePresence>
                    {showReviewForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-muted/50 rounded-xl p-4 space-y-3 mb-4">
                        <div>
                          <Label>Ваше имя</Label>
                          <Input value={reviewForm.reviewer_name} onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })} placeholder="Иван Иванов" />
                        </div>
                        <div>
                          <Label>Общая оценка</Label>
                          <StarRating value={reviewForm.rating} onChange={(v) => setReviewForm({ ...reviewForm, rating: v })} size={5} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Качество</Label>
                            <StarRating value={reviewForm.quality_score} onChange={(v) => setReviewForm({ ...reviewForm, quality_score: v })} />
                          </div>
                          <div>
                            <Label className="text-xs">Пунктуальность</Label>
                            <StarRating value={reviewForm.punctuality_score} onChange={(v) => setReviewForm({ ...reviewForm, punctuality_score: v })} />
                          </div>
                          <div>
                            <Label className="text-xs">Безопасность</Label>
                            <StarRating value={reviewForm.safety_score} onChange={(v) => setReviewForm({ ...reviewForm, safety_score: v })} />
                          </div>
                        </div>
                        <div>
                          <Label>Комментарий</Label>
                          <Textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} rows={3} placeholder="Расскажите о работе специалиста..." />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => submitReviewMutation.mutate()} disabled={submitReviewMutation.isPending || !reviewForm.reviewer_name}>
                            {submitReviewMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            Отправить
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowReviewForm(false)}>Отмена</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Review list */}
                  {reviews.length > 0 ? (
                    <div className="space-y-3">
                      {reviews.map((r) => (
                        <div key={r.id} className="bg-muted/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {r.reviewer_name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{r.reviewer_name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(r.created_at).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                            </div>
                            <StarRating value={r.rating} />
                          </div>
                          {r.comment && <p className="text-sm text-muted-foreground mt-2">{r.comment}</p>}
                          <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                            <span>Качество: {r.quality_score}/5</span>
                            <span>Пунктуальность: {r.punctuality_score}/5</span>
                            <span>Безопасность: {r.safety_score}/5</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Пока нет отзывов</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
