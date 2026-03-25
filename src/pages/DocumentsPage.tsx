import { motion } from "framer-motion";
import { FileText, Download, Eye, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const documents = [
  { id: 1, name: "Договор №2401 — ООО Стройком", type: "contract", date: "15.03.2024", status: "signed" },
  { id: 2, name: "Смета: Мойка фасада — ТЦ Мега", type: "estimate", date: "14.03.2024", status: "draft" },
  { id: 3, name: "Акт выполненных работ №2403", type: "act", date: "12.03.2024", status: "signed" },
  { id: 4, name: "Прайс-лист (март 2024)", type: "price", date: "01.03.2024", status: "active" },
  { id: 5, name: "Договор №2404 — ЖК Солнечный", type: "contract", date: "16.03.2024", status: "pending" },
  { id: 6, name: "Финансовый отчёт — февраль 2024", type: "report", date: "01.03.2024", status: "active" },
];

const typeLabels: Record<string, string> = {
  contract: "Договор",
  estimate: "Смета",
  act: "Акт",
  price: "Прайс",
  report: "Отчёт",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  signed: { label: "Подписан", variant: "default" },
  draft: { label: "Черновик", variant: "secondary" },
  pending: { label: "На подписи", variant: "outline" },
  active: { label: "Актуален", variant: "default" },
};

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Документы</h1>
          <p className="text-muted-foreground text-sm mt-1">Договоры, сметы, акты и отчёты</p>
        </div>
        <Button className="gap-2">
          <FileText className="w-4 h-4" /> Создать документ
        </Button>
      </div>

      <div className="space-y-3">
        {documents.map((doc, i) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card rounded-xl border border-border p-4 flex items-center justify-between hover:shadow-sm hover:border-primary/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-card-foreground">{doc.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{typeLabels[doc.type]}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {doc.date}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusLabels[doc.status].variant}>
                {statusLabels[doc.status].label}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
