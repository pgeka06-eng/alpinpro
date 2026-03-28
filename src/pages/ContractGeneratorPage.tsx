import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Sparkles, Loader2, Printer, Building2, User, MapPin,
  Banknote, Wrench, ChevronDown, ChevronUp, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const WORK_TYPES = [
  "Мойка фасадов",
  "Покраска фасадов",
  "Герметизация швов",
  "Утепление фасадов",
  "Монтаж/демонтаж рекламных конструкций",
  "Ремонт кровли",
  "Очистка кровли от снега и наледи",
  "Монтаж водосточных систем",
  "Высотная покраска",
  "Промышленный альпинизм — общие работы",
];

const UNITS = ["м²", "п.м.", "шт", "м.п.", "м³", "компл", "объект", "час", "смена"];

export default function ContractGeneratorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [executorOpen, setExecutorOpen] = useState(true);
  const [clientOpen, setClientOpen] = useState(true);
  const [workOpen, setWorkOpen] = useState(true);
  const [requisitesExecutorOpen, setRequisitesExecutorOpen] = useState(false);
  const [requisitesClientOpen, setRequisitesClientOpen] = useState(false);

  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Executor
    executor_company: "",
    executor_name: "",
    executor_position: "Директор",
    executor_inn: "",
    executor_kpp: "",
    executor_address: "",
    executor_bank: "",
    executor_account: "",
    executor_bik: "",
    executor_corr_account: "",
    // Client
    client_company: "",
    client_name: "",
    client_position: "Директор",
    client_inn: "",
    client_kpp: "",
    client_address: "",
    client_bank: "",
    client_account: "",
    client_bik: "",
    client_corr_account: "",
    // Work
    service_type: "",
    service_description: "",
    work_address: "",
    volume: "",
    unit: "м²",
    price_per_unit: "",
    total_price: "",
    deadline: "",
    // Additional
    city: "",
    contract_date: new Date().toISOString().slice(0, 10),
    payment_method: "безналичный расчёт",
    additional_conditions: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-calculate total
      if ((field === "volume" || field === "price_per_unit") && next.volume && next.price_per_unit) {
        next.total_price = String(Number(next.volume) * Number(next.price_per_unit));
      }
      return next;
    });
  };

  // Load clients for autofill
  const { data: clients = [] } = useQuery({
    queryKey: ["gen-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("name, company, phone, email").limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-contract-ai", {
        body: form,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.html as string;
    },
    onSuccess: (html) => {
      setGeneratedHtml(html);
      toast.success("Договор сгенерирован!");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Ошибка генерации");
    },
  });

  // Save as contract in DB
  const saveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const number = `ДП-${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
      const { error } = await supabase.from("contracts").insert({
        user_id: user!.id,
        type: "contract",
        number,
        client_name: form.client_company || form.client_name,
        client_email: null,
        client_phone: null,
        description: `${form.service_type} — ${form.work_address || "адрес не указан"}`,
        total_price: Number(form.total_price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-contracts"] });
      toast.success("Договор сохранён в документы");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePrint = () => {
    if (!generatedHtml) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Разрешите всплывающие окна"); return; }
    w.document.write(generatedHtml);
    w.document.close();
    w.document.title = `Договор — ${form.client_company}`;
    setTimeout(() => w.print(), 500);
  };

  const isValid = form.executor_company && form.client_company && form.service_type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Генератор договоров
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Заполните данные — ИИ составит профессиональный договор подряда
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <div className="space-y-4">
          {/* Executor */}
          <Collapsible open={executorOpen} onOpenChange={setExecutorOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> Исполнитель
                    </span>
                    {executorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <div>
                    <Label>Название компании *</Label>
                    <Input value={form.executor_company} onChange={(e) => updateField("executor_company", e.target.value)} placeholder='ООО "Высотные работы"' />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ФИО представителя</Label>
                      <Input value={form.executor_name} onChange={(e) => updateField("executor_name", e.target.value)} placeholder="Иванов И.И." />
                    </div>
                    <div>
                      <Label>Должность</Label>
                      <Input value={form.executor_position} onChange={(e) => updateField("executor_position", e.target.value)} placeholder="Директор" />
                    </div>
                  </div>
                  <div>
                    <Label>Юр. адрес</Label>
                    <Input value={form.executor_address} onChange={(e) => updateField("executor_address", e.target.value)} placeholder="г. Москва, ул. ..." />
                  </div>

                  <Collapsible open={requisitesExecutorOpen} onOpenChange={setRequisitesExecutorOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                        <Banknote className="h-3 w-3" />
                        Банковские реквизиты
                        {requisitesExecutorOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>ИНН</Label><Input value={form.executor_inn} onChange={(e) => updateField("executor_inn", e.target.value)} placeholder="7701234567" /></div>
                        <div><Label>КПП</Label><Input value={form.executor_kpp} onChange={(e) => updateField("executor_kpp", e.target.value)} placeholder="770101001" /></div>
                      </div>
                      <div><Label>Банк</Label><Input value={form.executor_bank} onChange={(e) => updateField("executor_bank", e.target.value)} placeholder="ПАО Сбербанк" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Р/счёт</Label><Input value={form.executor_account} onChange={(e) => updateField("executor_account", e.target.value)} placeholder="40702810..." /></div>
                        <div><Label>БИК</Label><Input value={form.executor_bik} onChange={(e) => updateField("executor_bik", e.target.value)} placeholder="044525225" /></div>
                      </div>
                      <div><Label>Корр. счёт</Label><Input value={form.executor_corr_account} onChange={(e) => updateField("executor_corr_account", e.target.value)} placeholder="30101810..." /></div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Client */}
          <Collapsible open={clientOpen} onOpenChange={setClientOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Заказчик
                    </span>
                    {clientOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  {clients.length > 0 && (
                    <div>
                      <Label>Выбрать из базы клиентов</Label>
                      <Select onValueChange={(val) => {
                        const c = clients.find((cl) => cl.name === val);
                        if (c) {
                          updateField("client_company", c.company || c.name);
                          updateField("client_name", c.name);
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Выберите клиента..." /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.company ? `${c.company} — ${c.name}` : c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Название компании *</Label>
                    <Input value={form.client_company} onChange={(e) => updateField("client_company", e.target.value)} placeholder='ООО "Заказчик"' />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>ФИО представителя</Label>
                      <Input value={form.client_name} onChange={(e) => updateField("client_name", e.target.value)} placeholder="Петров П.П." />
                    </div>
                    <div>
                      <Label>Должность</Label>
                      <Input value={form.client_position} onChange={(e) => updateField("client_position", e.target.value)} placeholder="Директор" />
                    </div>
                  </div>
                  <div>
                    <Label>Юр. адрес</Label>
                    <Input value={form.client_address} onChange={(e) => updateField("client_address", e.target.value)} placeholder="г. Москва, ул. ..." />
                  </div>

                  <Collapsible open={requisitesClientOpen} onOpenChange={setRequisitesClientOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                        <Banknote className="h-3 w-3" />
                        Банковские реквизиты
                        {requisitesClientOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>ИНН</Label><Input value={form.client_inn} onChange={(e) => updateField("client_inn", e.target.value)} placeholder="7701234567" /></div>
                        <div><Label>КПП</Label><Input value={form.client_kpp} onChange={(e) => updateField("client_kpp", e.target.value)} placeholder="770101001" /></div>
                      </div>
                      <div><Label>Банк</Label><Input value={form.client_bank} onChange={(e) => updateField("client_bank", e.target.value)} placeholder="ПАО Сбербанк" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Р/счёт</Label><Input value={form.client_account} onChange={(e) => updateField("client_account", e.target.value)} placeholder="40702810..." /></div>
                        <div><Label>БИК</Label><Input value={form.client_bik} onChange={(e) => updateField("client_bik", e.target.value)} placeholder="044525225" /></div>
                      </div>
                      <div><Label>Корр. счёт</Label><Input value={form.client_corr_account} onChange={(e) => updateField("client_corr_account", e.target.value)} placeholder="30101810..." /></div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Work Details */}
          <Collapsible open={workOpen} onOpenChange={setWorkOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" /> Работы и условия
                    </span>
                    {workOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <div>
                    <Label>Вид работ *</Label>
                    <Select value={form.service_type} onValueChange={(v) => updateField("service_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Выберите тип работ" /></SelectTrigger>
                      <SelectContent>
                        {WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Подробное описание работ</Label>
                    <Textarea value={form.service_description} onChange={(e) => updateField("service_description", e.target.value)} placeholder="Мойка фасада здания с применением..." rows={3} />
                  </div>
                  <div>
                    <Label>Адрес проведения работ</Label>
                    <Input value={form.work_address} onChange={(e) => updateField("work_address", e.target.value)} placeholder="г. Москва, ул. Ленина, д. 1" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Объём</Label>
                      <Input type="number" value={form.volume} onChange={(e) => updateField("volume", e.target.value)} placeholder="100" />
                    </div>
                    <div>
                      <Label>Ед. изм.</Label>
                      <Select value={form.unit} onValueChange={(v) => updateField("unit", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Цена за ед. (₽)</Label>
                      <Input type="number" value={form.price_per_unit} onChange={(e) => updateField("price_per_unit", e.target.value)} placeholder="350" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Итого (₽)</Label>
                      <Input type="number" value={form.total_price} onChange={(e) => updateField("total_price", e.target.value)} placeholder="35000" className="font-semibold" />
                    </div>
                    <div>
                      <Label>Срок выполнения</Label>
                      <Input value={form.deadline} onChange={(e) => updateField("deadline", e.target.value)} placeholder="10 рабочих дней" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Город</Label>
                      <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="г. Москва" />
                    </div>
                    <div>
                      <Label>Дата договора</Label>
                      <Input type="date" value={form.contract_date} onChange={(e) => updateField("contract_date", e.target.value)} />
                    </div>
                    <div>
                      <Label>Оплата</Label>
                      <Select value={form.payment_method} onValueChange={(v) => updateField("payment_method", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="безналичный расчёт">Безнал</SelectItem>
                          <SelectItem value="наличный расчёт">Наличные</SelectItem>
                          <SelectItem value="по согласованию">По согласованию</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Дополнительные условия</Label>
                    <Textarea value={form.additional_conditions} onChange={(e) => updateField("additional_conditions", e.target.value)} placeholder="Работы выполняются при температуре не ниже -10°C..." rows={2} />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Generate Button */}
          <Button
            className="w-full h-12 text-base gap-2"
            disabled={!isValid || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Генерация договора...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Сгенерировать договор</>
            )}
          </Button>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:sticky lg:top-4">
          <Card className="h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Предпросмотр
              </CardTitle>
              {generatedHtml && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" /> Печать
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" /> Сохранить
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {generatedHtml ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6"
                >
                  <iframe
                    srcDoc={generatedHtml}
                    className="w-full h-full min-h-[600px] border-0"
                    title="Contract preview"
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
                  <FileText className="h-16 w-16 opacity-20" />
                  <p className="text-center">
                    Заполните данные слева и нажмите<br />
                    <strong>«Сгенерировать договор»</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
