import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  HardHat, CheckCircle2, FileText, Clock, Shield, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Estimate {
  id: string;
  token: string;
  client_name: string;
  description: string | null;
  status: string;
  service_name: string;
  unit: string;
  base_price: number;
  volume: number;
  coeff_urgency: number;
  coeff_complexity: number;
  coeff_height: number;
  coeff_season: number;
  total_coeff: number;
  total_price: number;
  signed_at: string | null;
  signed_ip: string | null;
  signed_device: string | null;
  created_at: string;
}

const coeffNames: Record<string, string> = {
  urgency: "Срочность",
  complexity: "Сложность",
  height: "Высота",
  season: "Сезон",
};

export default function ClientEstimatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Ссылка недействительна");
      setLoading(false);
      return;
    }

    const fetchEstimate = async () => {
      const { data, error: fetchError } = await supabase
        .from("estimates")
        .select("*")
        .eq("token", token)
        .single();

      if (fetchError || !data) {
        setError("Смета не найдена");
      } else {
        setEstimate(data);
        // Mark as viewed if pending
        if (data.status === "pending") {
          await supabase
            .from("estimates")
            .update({ status: "viewed" })
            .eq("id", data.id);
        }
      }
      setLoading(false);
    };

    fetchEstimate();
  }, [token]);

  const handleSign = async () => {
    if (!estimate || !token) return;
    setSigning(true);

    try {
      const { data, error } = await supabase.functions.invoke("sign-estimate", {
        body: { token },
      });

      if (error) throw error;

      setEstimate((prev) => prev ? { ...prev, status: "agreed", signed_at: new Date().toISOString() } : null);
      toast.success("Смета подтверждена!");
    } catch (err: any) {
      toast.error("Ошибка: " + (err.message || "не удалось подписать"));
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{error || "Ошибка"}</h1>
          <p className="text-muted-foreground text-sm">Проверьте ссылку и попробуйте снова</p>
        </div>
      </div>
    );
  }

  const coefficients = [
    { key: "urgency", value: estimate.coeff_urgency },
    { key: "complexity", value: estimate.coeff_complexity },
    { key: "height", value: estimate.coeff_height },
    { key: "season", value: estimate.coeff_season },
  ].filter((c) => c.value > 1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-card-foreground">AlpinPro</h1>
            <p className="text-[11px] text-muted-foreground">Смета на высотные работы</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Status banner */}
        {estimate.status === "agreed" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Смета подтверждена</p>
              <p className="text-xs text-success/70">
                {estimate.signed_at && new Date(estimate.signed_at).toLocaleString("ru")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Client info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Смета</h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Клиент</span>
              <span className="font-medium text-card-foreground">{estimate.client_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Дата</span>
              <span className="text-card-foreground">
                {new Date(estimate.created_at).toLocaleDateString("ru")}
              </span>
            </div>
            {estimate.description && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">{estimate.description}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Calculation breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-6 space-y-4"
        >
          <h3 className="text-base font-semibold text-card-foreground">Расчёт стоимости</h3>

          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-card-foreground">{estimate.service_name}</p>
            <p className="text-xs text-muted-foreground">
              {Number(estimate.base_price).toLocaleString("ru")} ₽/{estimate.unit} × {Number(estimate.volume)} {estimate.unit}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Базовая стоимость</span>
              <span className="font-mono text-card-foreground">
                {(Number(estimate.base_price) * Number(estimate.volume)).toLocaleString("ru")} ₽
              </span>
            </div>

            {coefficients.length > 0 && (
              <div className="space-y-1.5 border-l-2 border-primary/20 pl-3 py-1">
                {coefficients.map((c) => (
                  <div key={c.key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{coeffNames[c.key]}</span>
                    <span className="font-mono text-warning">×{c.value}</span>
                  </div>
                ))}
              </div>
            )}

            {Number(estimate.total_coeff) > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Общий коэффициент</span>
                <span className="font-mono text-primary">×{Number(estimate.total_coeff).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-end">
              <span className="text-base font-medium text-card-foreground">Итого к оплате</span>
              <span className="text-3xl font-bold font-mono text-gradient">
                {Number(estimate.total_price).toLocaleString("ru")} ₽
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sign section */}
        {estimate.status !== "agreed" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-card-foreground">Подтверждение</h3>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs text-muted-foreground">
              <p>Нажимая «Согласен», вы подтверждаете:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Ознакомление с расчётом стоимости</li>
                <li>Согласие с указанной суммой</li>
                <li>Фиксация времени, IP-адреса и устройства</li>
              </ul>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSign}
              disabled={signing}
            >
              {signing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {signing ? "Подтверждение..." : "Согласен"}
            </Button>

            <div className="flex items-center gap-1.5 justify-center text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Данные подписи защищены и хранятся на сервере</span>
            </div>
          </motion.div>
        )}

        {/* Signature details (after signing) */}
        {estimate.status === "agreed" && estimate.signed_at && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-success" />
              <h3 className="text-base font-semibold text-card-foreground">Данные подписи</h3>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата и время</span>
                <span className="text-card-foreground">
                  {new Date(estimate.signed_at).toLocaleString("ru")}
                </span>
              </div>
              {estimate.signed_ip && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP-адрес</span>
                  <span className="font-mono text-card-foreground">{estimate.signed_ip}</span>
                </div>
              )}
              {estimate.signed_device && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Устройство</span>
                  <span className="text-card-foreground">{estimate.signed_device}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
