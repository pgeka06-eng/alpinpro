import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send, Copy, Check, Loader2, Link } from "lucide-react";
import { toast } from "sonner";

interface SendEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  unit: string;
  basePrice: number;
  volume: number;
  coeffUrgency: number;
  coeffComplexity: number;
  coeffHeight: number;
  coeffSeason: number;
  totalCoeff: number;
  totalPrice: number;
}

export function SendEstimateDialog({
  open,
  onOpenChange,
  serviceName,
  unit,
  basePrice,
  volume,
  coeffUrgency,
  coeffComplexity,
  coeffHeight,
  coeffSeason,
  totalCoeff,
  totalPrice,
}: SendEstimateDialogProps) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!user || !clientName.trim()) {
      toast.error("Укажите имя клиента");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("estimates")
        .insert({
          user_id: user.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || null,
          client_phone: clientPhone.trim() || null,
          description: description.trim() || null,
          service_name: serviceName,
          unit,
          base_price: basePrice,
          volume,
          coeff_urgency: coeffUrgency,
          coeff_complexity: coeffComplexity,
          coeff_height: coeffHeight,
          coeff_season: coeffSeason,
          total_coeff: totalCoeff,
          total_price: totalPrice,
        })
        .select("token")
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/estimate?token=${data.token}`;
      setGeneratedLink(link);
      toast.success("Смета создана!");
    } catch (err: any) {
      toast.error("Ошибка: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Ссылка скопирована!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setGeneratedLink("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setDescription("");
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отправить смету клиенту</DialogTitle>
          <DialogDescription>
            Создайте уникальную ссылку для просмотра и подтверждения
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-card-foreground">{serviceName}</p>
              <p className="text-xs text-muted-foreground">
                {basePrice.toLocaleString("ru")} ₽/{unit} × {volume} {unit} × {totalCoeff.toFixed(2)}
              </p>
              <p className="text-lg font-bold font-mono text-gradient">
                {totalPrice.toLocaleString("ru")} ₽
              </p>
            </div>

            <div className="space-y-2">
              <Label>Имя клиента *</Label>
              <Input
                placeholder="ООО Стройком"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="client@mail.ru"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  placeholder="+7 999 123-45-67"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Описание работ</Label>
              <Textarea
                placeholder="Дополнительная информация..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <Button className="w-full gap-2" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {saving ? "Создание..." : "Создать ссылку"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg p-3">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm text-success font-medium">Ссылка создана!</span>
            </div>

            <div className="space-y-2">
              <Label>Ссылка для клиента</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Отправьте эту ссылку клиенту. После просмотра он сможет нажать «Согласен», 
              и система зафиксирует время, IP-адрес и устройство.
            </p>

            <Button variant="outline" className="w-full gap-2" onClick={() => handleClose(false)}>
              <Link className="w-4 h-4" /> Готово
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
