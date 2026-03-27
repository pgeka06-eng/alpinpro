import * as XLSX from "xlsx";

export interface ParsedPriceItem {
  service_name: string;
  unit: string;
  price: number;
  description: string | null;
}

const UNIT_KEYWORDS = ["м²", "м2", "кв.м", "п.м.", "м.п.", "шт", "шт.", "п.м", "л.м.", "комп", "компл", "усл", "час", "смена", "м³", "м3", "куб.м", "т", "кг"];

function guessColumns(rows: any[][]): { nameCol: number; unitCol: number; priceCol: number } | null {
  if (rows.length < 2) return null;

  // Try to find header row
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    let nameCol = -1, unitCol = -1, priceCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || "").toLowerCase().trim();
      if (nameCol === -1 && (val.includes("наименование") || val.includes("услуг") || val.includes("название") || val.includes("работ") || val.includes("вид"))) {
        nameCol = c;
      } else if (unitCol === -1 && (val.includes("ед.") || val.includes("единиц") || val.includes("изм"))) {
        unitCol = c;
      } else if (priceCol === -1 && (val.includes("цена") || val.includes("стоимость") || val.includes("руб") || val.includes("тариф"))) {
        priceCol = c;
      }
    }

    if (nameCol !== -1 && priceCol !== -1) {
      return { nameCol, unitCol: unitCol === -1 ? nameCol + 1 : unitCol, priceCol };
    }
  }

  // Fallback: first text col = name, find first numeric col = price
  if (rows.length > 1) {
    const sampleRow = rows[1];
    if (!sampleRow) return null;
    let nameCol = 0, priceCol = -1;
    for (let c = 0; c < sampleRow.length; c++) {
      const val = sampleRow[c];
      if (typeof val === "number" && val > 0 && priceCol === -1 && c > 0) {
        priceCol = c;
      }
    }
    if (priceCol !== -1) {
      return { nameCol, unitCol: priceCol - 1 > nameCol ? priceCol - 1 : nameCol + 1, priceCol };
    }
  }

  return null;
}

function detectUnit(val: any): string {
  if (!val) return "шт";
  const s = String(val).trim().toLowerCase();
  for (const u of UNIT_KEYWORDS) {
    if (s.includes(u.toLowerCase())) return u;
  }
  return s || "шт";
}

export async function parseExcelFile(file: File): Promise<ParsedPriceItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const items: ParsedPriceItem[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    const cols = guessColumns(rows);
    if (!cols) continue;

    // Find header row index (skip it)
    let startRow = 1;
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const val = String(rows[r]?.[cols.nameCol] || "").toLowerCase();
      if (val.includes("наименование") || val.includes("услуг") || val.includes("название") || val.includes("работ")) {
        startRow = r + 1;
        break;
      }
    }

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const name = String(row[cols.nameCol] || "").trim();
      if (!name || name.length < 2) continue;

      const rawPrice = row[cols.priceCol];
      const price = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

      // Skip rows that look like headers/sections (no price, all text)
      if (price === 0 && !row[cols.unitCol]) continue;

      items.push({
        service_name: name,
        unit: detectUnit(row[cols.unitCol]),
        price,
        description: null,
      });
    }
  }

  return items;
}

const EXCEL_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export function isExcelFile(file: File): boolean {
  return EXCEL_TYPES.includes(file.type) || /\.xlsx?$/i.test(file.name);
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function isSupportedFile(file: File): boolean {
  return isPdfFile(file) || isExcelFile(file);
}
