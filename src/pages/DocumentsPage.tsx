import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Eye, Calendar, Plus, Send, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Contract = {
  id: string;
  type: string;
  number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  description: string | null;
  total_price: number;
  status: string;
  token: string;
  estimate_id: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_device: string | null;
  pdf_path: string | null;
  created_at: string;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  sent: { label: "На подписи", variant: "outline" },
  signed: { label: "Подписан", variant: "default" },
};

const typeLabels: Record<string, string> = {
  contract: "Договор",
  act: "Акт",
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "contract",
    client_name: "",
    client_email: "",
    client_phone: "",
    description: "",
    total_price: "",
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates-for-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, client_name, service_name, total_price, status")
        .eq("status", "agreed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const number = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(contracts.length + 1).padStart(2, "0")}`;
      
      let estimate = null;
      if (selectedEstimateId) {
        const { data } = await supabase.from("estimates").select("*").eq("id", selectedEstimateId).single();
        estimate = data;
      }

      const { error } = await supabase.from("contracts").insert({
        user_id: user!.id,
        type: formData.type,
        number,
        client_name: estimate?.client_name || formData.client_name,
        client_email: estimate?.client_email || formData.client_email || null,
        client_phone: estimate?.client_phone || formData.client_phone || null,
        description: formData.description || null,
        total_price: estimate?.total_price || Number(formData.total_price) || 0,
        estimate_id: selectedEstimateId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setCreateOpen(false);
      setFormData({ type: "contract", client_name: "", client_email: "", client_phone: "", description: "", total_price: "" });
      setSelectedEstimateId("");
      toast.success("Документ создан");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generatePdfMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-contract-pdf", {
        body: { contractId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Документ сгенерирован");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("contracts")
        .update({ status: "sent" })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Статус обновлён на 'На подписи'");
    },
  });

  const getSignLink = (token: string) => {
    return `${window.location.origin}/contract/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getSignLink(token));
    toast.success("Ссылка скопирована");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Документы</h1>
          <p className="text-muted-foreground text-sm mt-1">Договоры и акты выполненных работ</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Создать документ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый документ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Тип</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Договор</SelectItem>
                      <SelectItem value="act">Акт выполненных работ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>На основе сметы</Label>
                  <Select value={selectedEstimateId} onValueChange={setSelectedEstimateId}>
                    <SelectTrigger><SelectValue placeholder="Без сметы" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без сметы</SelectItem>
                      {estimates.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.client_name} — {e.service_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedEstimateId || selectedEstimateId === "none" ? (
                <>
                  <div>
                    <Label>Клиент</Label>
                    <Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="ООО Стройком" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input value={formData.client_email} onChange={(e) => setFormData({ ...formData, client_email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Телефон</Label>
                      <Input value={formData.client_phone} onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Сумма, ₽</Label>
                    <Input type="number" value={formData.total_price} onChange={(e) => setFormData({ ...formData, total_price: e.target.value })} />
                  </div>
                </>
              ) : null}

              <div>
                <Label>Описание работ</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Мойка фасада здания..." rows={3} />
              </div>

              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет документов</p>
          <p className="text-sm mt-1">Создайте договор или акт</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-sm hover:border-primary/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-card-foreground">
                      {typeLabels[doc.type] || doc.type} №{doc.number} — {doc.client_name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {Number(doc.total_price).toLocaleString("ru-RU")} ₽
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.created_at).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusConfig[doc.status]?.variant || "secondary"}>
                    {statusConfig[doc.status]?.label || doc.status}
                  </Badge>

                  {doc.signed_at && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Сгенерировать PDF"
                    onClick={() => generatePdfMutation.mutate(doc.id)}
                    disabled={generatePdfMutation.isPending}
                  >
                    {generatePdfMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>

                  {doc.pdf_path && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Открыть"
                      onClick={() => {
                        const { data } = supabase.storage.from("contracts").getPublicUrl(doc.pdf_path!);
                        window.open(data.publicUrl, "_blank");
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}

                  {doc.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => sendMutation.mutate(doc.id)}
                    >
                      <Send className="w-3.5 h-3.5" /> Отправить
                    </Button>
                  )}

                  {doc.status === "sent" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyLink(doc.token)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ссылка
                    </Button>
                  )}
                </div>
              </div>

              {doc.signed_at && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground grid grid-cols-3 gap-2">
                  <span>Подписан: {new Date(doc.signed_at).toLocaleString("ru-RU")}</span>
                  <span>IP: {doc.signed_ip || "—"}</span>
                  <span>Устройство: {doc.signed_device || "—"}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Предпросмотр документа</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full flex-1 rounded-lg border border-border" style={{ height: "calc(80vh - 80px)" }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
