import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2, Trash2, Edit3, Save, History, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface PriceList {
  id: string;
  name: string;
  status: string;
  created_at: string;
  file_path: string | null;
}

interface PriceItem {
  id: string;
  service_name: string;
  unit: string;
  price: number;
  description: string | null;
  is_verified: boolean;
  sort_order: number;
  price_list_id: string;
}

interface HistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export default function PriceListsPage() {
  const { user } = useAuth();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ service_name: "", unit: "", price: 0, description: "" });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPriceLists = useCallback(async () => {
    const { data } = await supabase
      .from("price_lists")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPriceLists(data);
    setLoading(false);
  }, []);

  const fetchItems = useCallback(async (listId: string) => {
    const { data } = await supabase
      .from("price_items")
      .select("*")
      .eq("price_list_id", listId)
      .order("sort_order");
    if (data) setItems(data);
  }, []);

  const fetchHistory = useCallback(async (itemId: string) => {
    const { data } = await supabase
      .from("price_history")
      .select("*")
      .eq("price_item_id", itemId)
      .order("created_at", { ascending: false });
    if (data) setHistory(data);
  }, []);

  useEffect(() => {
    fetchPriceLists();
  }, [fetchPriceLists]);

  useEffect(() => {
    if (selectedList) fetchItems(selectedList);
  }, [selectedList, fetchItems]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const pdfFiles = Array.from(files).filter((f) => f.type === "application/pdf");
    if (pdfFiles.length === 0) {
      toast.error("Выберите PDF файлы");
      return;
    }
    if (pdfFiles.length < files.length) {
      toast.warning(`${files.length - pdfFiles.length} файл(ов) пропущено (не PDF)`);
    }

    setUploading(true);
    let successCount = 0;
    let totalItems = 0;
    let lastListId: string | null = null;

    for (const file of pdfFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user.id}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from("price-pdfs").upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: priceList, error: plError } = await supabase
          .from("price_lists")
          .insert({ user_id: user.id, name: file.name.replace(".pdf", ""), file_path: filePath, status: "pending" })
          .select()
          .single();
        if (plError) throw plError;

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke("parse-price-pdf", {
          body: { priceListId: priceList.id, fileBase64: base64 },
        });
        if (error) throw error;
        successCount++;
        totalItems += data?.itemCount || 0;
        lastListId = priceList.id;
      } catch (err: any) {
        toast.error(`Ошибка «${file.name}»: ${err.message || "неизвестная ошибка"}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Загружено ${successCount} файл(ов), распознано ${totalItems} услуг`);
      fetchPriceLists();
      if (lastListId) setSelectedList(lastListId);
    }
    setUploading(false);
    e.target.value = "";
  };

  const startEdit = (item: PriceItem) => {
    setEditingItem(item.id);
    setEditForm({
      service_name: item.service_name,
      unit: item.unit,
      price: item.price,
      description: item.description || "",
    });
  };

  const saveEdit = async (item: PriceItem) => {
    if (!user) return;

    // Record history for changed fields
    const changes: { field_name: string; old_value: string; new_value: string }[] = [];
    if (editForm.service_name !== item.service_name) {
      changes.push({ field_name: "service_name", old_value: item.service_name, new_value: editForm.service_name });
    }
    if (editForm.unit !== item.unit) {
      changes.push({ field_name: "unit", old_value: item.unit, new_value: editForm.unit });
    }
    if (editForm.price !== item.price) {
      changes.push({ field_name: "price", old_value: String(item.price), new_value: String(editForm.price) });
    }

    if (changes.length > 0) {
      await supabase.from("price_history").insert(
        changes.map((c) => ({ ...c, price_item_id: item.id, changed_by: user.id }))
      );
    }

    await supabase
      .from("price_items")
      .update({
        service_name: editForm.service_name,
        unit: editForm.unit,
        price: editForm.price,
        description: editForm.description || null,
        is_verified: true,
      })
      .eq("id", item.id);

    setEditingItem(null);
    fetchItems(item.price_list_id);
    toast.success("Сохранено");
  };

  const verifyItem = async (item: PriceItem) => {
    await supabase.from("price_items").update({ is_verified: true }).eq("id", item.id);
    fetchItems(item.price_list_id);
  };

  const deleteList = async (id: string) => {
    await supabase.from("price_lists").delete().eq("id", id);
    if (selectedList === id) {
      setSelectedList(null);
      setItems([]);
    }
    fetchPriceLists();
    toast.success("Прайс удалён");
  };

  const addManualItem = async () => {
    if (!selectedList || !user) return;
    await supabase.from("price_items").insert({
      price_list_id: selectedList,
      service_name: "Новая услуга",
      unit: "шт",
      price: 0,
      sort_order: items.length,
    });
    fetchItems(selectedList);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("price_items").delete().eq("id", id);
    if (selectedList) fetchItems(selectedList);
    toast.success("Удалено");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Ожидание", variant: "secondary" },
      parsing: { label: "Распознавание...", variant: "outline" },
      parsed: { label: "Готов", variant: "default" },
      error: { label: "Ошибка", variant: "destructive" },
    };
    const s = map[status] || map.pending;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Прайс-листы</h1>
          <p className="text-muted-foreground text-sm mt-1">Загрузка PDF, распознавание услуг и цен</p>
        </div>
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={uploading}
          />
          <Button className="gap-2" disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Загрузка..." : "Загрузить PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price lists sidebar */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Загрузка...
            </div>
          ) : priceLists.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Загрузите первый PDF прайс-лист</p>
            </div>
          ) : (
            priceLists.map((pl) => (
              <motion.div
                key={pl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedList(pl.id)}
                className={`bg-card rounded-xl border p-4 cursor-pointer transition-all ${
                  selectedList === pl.id
                    ? "border-primary shadow-glow"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-card-foreground truncate">{pl.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(pl.created_at).toLocaleDateString("ru")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(pl.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); deleteList(pl.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Items table */}
        <div className="lg:col-span-2">
          {selectedList ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-card-foreground">Распознанные услуги</h3>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addManualItem}>
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {priceLists.find((p) => p.id === selectedList)?.status === "parsing" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Распознавание...
                    </div>
                  ) : (
                    "Нет услуг"
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id}>
                      <div className="p-4 hover:bg-muted/30 transition-colors">
                        {editingItem === item.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Input
                                value={editForm.service_name}
                                onChange={(e) => setEditForm((f) => ({ ...f, service_name: e.target.value }))}
                                placeholder="Название услуги"
                              />
                              <Input
                                value={editForm.unit}
                                onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                                placeholder="Ед. изм."
                              />
                              <Input
                                type="number"
                                value={editForm.price}
                                onChange={(e) => setEditForm((f) => ({ ...f, price: Number(e.target.value) }))}
                                placeholder="Цена"
                              />
                            </div>
                            <Input
                              value={editForm.description}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Описание (необязательно)"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="gap-1.5" onClick={() => saveEdit(item)}>
                                <Save className="w-3.5 h-3.5" /> Сохранить
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-card-foreground">{item.service_name}</span>
                                {item.is_verified ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground">{item.unit}</span>
                              <span className="text-sm font-mono font-semibold text-card-foreground whitespace-nowrap">
                                {item.price.toLocaleString("ru")} ₽
                              </span>
                              <div className="flex gap-1">
                                {!item.is_verified && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => verifyItem(item)}>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    if (showHistory === item.id) {
                                      setShowHistory(null);
                                    } else {
                                      setShowHistory(item.id);
                                      fetchHistory(item.id);
                                    }
                                  }}
                                >
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => deleteItem(item.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* History panel */}
                      <AnimatePresence>
                        {showHistory === item.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-muted/30 border-t border-border"
                          >
                            <div className="p-4 space-y-2">
                              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                История изменений
                              </h4>
                              {history.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Нет изменений</p>
                              ) : (
                                history.map((h) => (
                                  <div key={h.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                      {new Date(h.created_at).toLocaleString("ru")}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">{h.field_name}</Badge>
                                    <span className="text-destructive line-through">{h.old_value}</span>
                                    <span>→</span>
                                    <span className="text-success font-medium">{h.new_value}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Выберите прайс-лист слева или загрузите новый PDF</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
