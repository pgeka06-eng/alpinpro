import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type ContractData = {
  id: string;
  type: string;
  number: string;
  client_name: string;
  description: string | null;
  total_price: number;
  status: string;
  signed_at: string | null;
  signed_ip: string | null;
  signed_device: string | null;
  created_at: string;
};

export default function ContractSignPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Ссылка недействительна"); setLoading(false); return; }
    supabase
      .from("contracts")
      .select("*")
      .eq("token", token)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) setError("Документ не найден");
        else setContract(data as ContractData);
        setLoading(false);
      });
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    setSigning(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("sign-contract", {
        body: { token },
      });
      if (e) throw e;
      toast.success("Документ подписан!");
      // Reload
      const { data: updated } = await supabase.from("contracts").select("*").eq("token", token).single();
      if (updated) setContract(updated as ContractData);
    } catch {
      toast.error("Ошибка подписания");
    } finally {
      setSigning(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !contract) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <p className="text-lg font-medium text-foreground">{error || "Ошибка"}</p>
      </div>
    </div>
  );

  const isSigned = contract.status === "signed";
  const typeLabel = contract.type === "act" ? "Акт выполненных работ" : "Договор";

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-card-foreground">
                {typeLabel} №{contract.number}
              </h1>
              <p className="text-sm text-muted-foreground">
                от {new Date(contract.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Заказчик</span>
              <span className="text-sm font-medium text-card-foreground">{contract.client_name}</span>
            </div>
            {contract.description && (
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Описание</span>
                <span className="text-sm text-card-foreground text-right max-w-[60%]">{contract.description}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Сумма</span>
              <span className="text-lg font-bold text-card-foreground">
                {Number(contract.total_price).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>

          {isSigned ? (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-green-800 dark:text-green-300">Документ подписан</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {new Date(contract.signed_at!).toLocaleString("ru-RU")}
              </p>
              <div className="text-xs text-green-500 mt-2 space-y-0.5">
                <p>IP: {contract.signed_ip}</p>
                <p>Устройство: {contract.signed_device}</p>
              </div>
            </div>
          ) : contract.status === "sent" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Нажимая кнопку «Подписать», вы подтверждаете согласие с условиями документа. Будут зафиксированы: время, IP-адрес, устройство.
              </p>
              <Button onClick={handleSign} disabled={signing} size="lg" className="w-full">
                {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Подписать документ
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Документ ещё не отправлен на подпись.</p>
          )}
        </div>
      </div>
    </div>
  );
}
