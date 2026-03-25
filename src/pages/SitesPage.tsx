import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Plus, Edit2, Trash2, Save, X, Loader2, Building2, Phone, User,
  StickyNote, Camera, Clock, ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface SiteForm {
  name: string;
  address: string;
  city: string;
  lat: string;
  lng: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
}

const emptySiteForm: SiteForm = {
  name: "", address: "", city: "", lat: "", lng: "",
  contact_name: "", contact_phone: "", notes: "",
};

export default function SitesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteForm>(emptySiteForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  // Fetch sites
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch orders for work history
  const { data: orders = [] } = useQuery({
    queryKey: ["site-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, service_name, status, total_price, scheduled_date, completed_date, site_id")
        .not("site_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;

      // Upload photo if present
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("site-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("site-photos")
          .getPublicUrl(path);
        photo_url = urlData.publicUrl;
      }

      const payload: any = {
        name: form.name,
        address: form.address,
        city: form.city || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        notes: form.notes || null,
      };
      if (photo_url) payload.photo_url = photo_url;

      if (editingId) {
        const { error } = await supabase.from("sites").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.user_id = user!.id;
        const { error } = await supabase.from("sites").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success(editingId ? "Объект обновлён" : "Объект добавлен");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Объект удалён");
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptySiteForm);
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const openEdit = (site: any) => {
    setEditingId(site.id);
    setForm({
      name: site.name,
      address: site.address,
      city: site.city || "",
      lat: site.lat?.toString() || "",
      lng: site.lng?.toString() || "",
      contact_name: site.contact_name || "",
      contact_phone: site.contact_phone || "",
      notes: site.notes || "",
    });
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptySiteForm);
    setPhotoFile(null);
  };

  const filtered = sites.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase()) ||
    (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );

  const getSiteOrders = (siteId: string) =>
    orders.filter((o: any) => o.site_id === siteId);

  const statusLabels: Record<string, string> = {
    created: "Создан",
    in_progress: "В работе",
    completed: "Завершён",
    cancelled: "Отменён",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Объекты
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Здания и адреса, на которых ведутся работы</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Добавить
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Поиск по названию, адресу или городу..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Всего объектов</p>
          <p className="text-2xl font-bold text-foreground mt-1">{sites.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">С заказами</p>
          <p className="text-2xl font-bold text-primary mt-1">
            {sites.filter((s: any) => getSiteOrders(s.id).length > 0).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Городов</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {new Set(sites.map((s: any) => s.city).filter(Boolean)).size}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Работ выполнено</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {orders.filter((o: any) => o.status === "completed").length}
          </p>
        </div>
      </div>

      {/* Sites list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? "Объекты не найдены" : "Добавьте первый объект"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((site: any, i: number) => {
            const siteOrders = getSiteOrders(site.id);
            const isExpanded = expandedSite === site.id;
            return (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Photo */}
                    {site.photo_url ? (
                      <img
                        src={site.photo_url}
                        alt={site.name}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-card-foreground truncate">{site.name}</h3>
                        {site.city && (
                          <Badge variant="secondary" className="text-[10px]">{site.city}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" /> {site.address}
                      </p>
                      {site.contact_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" /> {site.contact_name}
                          {site.contact_phone && (
                            <a href={`tel:${site.contact_phone}`} className="text-primary hover:underline flex items-center gap-0.5 ml-2">
                              <Phone className="w-3 h-3" /> {site.contact_phone}
                            </a>
                          )}
                        </p>
                      )}
                      {siteOrders.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <ClipboardList className="w-3 h-3 inline mr-1" />
                          {siteOrders.length} {siteOrders.length === 1 ? "заказ" : siteOrders.length < 5 ? "заказа" : "заказов"}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {siteOrders.length > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(site)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Удалить объект?")) deleteMutation.mutate(site.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {site.notes && (
                    <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5 flex items-start gap-1.5">
                      <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {site.notes}
                    </div>
                  )}
                </div>

                {/* Work history */}
                {isExpanded && siteOrders.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">История работ</p>
                    {siteOrders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{order.order_number}</span>
                          <span className="text-card-foreground">{order.service_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[10px]">
                            {statusLabels[order.status] || order.status}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            {order.total_price?.toLocaleString("ru")} ₽
                          </span>
                          {order.completed_date && (
                            <span className="text-[11px] text-muted-foreground">
                              {format(parseISO(order.completed_date), "dd.MM.yy", { locale: ru })}
                            </span>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать объект" : "Новый объект"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                placeholder="ЖК Центральный, Бизнес-центр Альфа..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Адрес *</Label>
              <Input
                placeholder="ул. Ленина, 42"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                placeholder="Москва"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Широта</Label>
                <Input
                  placeholder="55.7558"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Долгота</Label>
                <Input
                  placeholder="37.6173"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Контактное лицо</Label>
                <Input
                  placeholder="Иван Иванов"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  placeholder="+7 999 123-45-67"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Заметки</Label>
              <Textarea
                placeholder="Особенности доступа, парковка, пропускной режим..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Camera className="w-4 h-4" /> Фото объекта</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.address || saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" /> {editingId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
