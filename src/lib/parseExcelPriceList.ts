import * as XLSX from "xlsx";

export interface ParsedPriceItem {
  service_name: string;
  unit: string;
  price: number;
  description: string | null;
  coefficient?: number | null;
}

const UNIT_KEYWORDS = [
  "м²", "м2", "кв.м", "кв.м.", "кв. м", "кв. м.",
  "п.м.", "м.п.", "п.м", "п. м.", "м. п.", "л.м.", "л. м.",
  "шт", "шт.", "штук", "штука",
  "компл", "компл.", "комплект", "комп", "комп.",
  "усл", "усл.", "услуга",
  "час", "ч.", "ч",
  "смена", "см.",
  "м³", "м3", "куб.м", "куб.м.", "куб. м",
  "т", "т.", "тонн", "тонна",
  "кг", "кг.",
  "л", "л.", "литр",
  "м", "м.", "метр",
  "объект", "объ.", "об.",
  "раз", "выезд",
];

const NAME_HEADERS = ["наименование", "услуг", "название", "работ", "вид", "описание", "позиция", "наим", "перечень", "состав"];
const UNIT_HEADERS = ["ед.", "единиц", "изм", "ед.изм", "ед. изм"];
const PRICE_HEADERS = ["цена", "стоимость", "руб", "тариф", "расценка", "ставка", "прайс", "сумма", "₽", "rub"];
const COEFF_HEADERS = ["коэф", "коэфф", "кф", "k", "множитель", "надбавка", "повыш", "понижающ"];

interface ColumnMap {
  nameCol: number;
  unitCol: number;
  priceCol: number;
  coeffCol: number;
  headerRow: number;
}

function normalizeStr(val: any): string {
  return String(val || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function matchesAny(val: string, keywords: string[]): boolean {
  return keywords.some(k => val.includes(k));
}

function guessColumns(rows: any[][]): ColumnMap | null {
  if (rows.length < 2) return null;

  // Try to find header row in first 10 rows
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;

    let nameCol = -1, unitCol = -1, priceCol = -1, coeffCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = normalizeStr(row[c]);
      if (!val || val.length < 2) continue;

      if (nameCol === -1 && matchesAny(val, NAME_HEADERS)) {
        nameCol = c;
      } else if (unitCol === -1 && matchesAny(val, UNIT_HEADERS)) {
        unitCol = c;
      } else if (priceCol === -1 && matchesAny(val, PRICE_HEADERS)) {
        priceCol = c;
      } else if (coeffCol === -1 && matchesAny(val, COEFF_HEADERS)) {
        coeffCol = c;
      }
    }

    if (nameCol !== -1 && priceCol !== -1) {
      return {
        nameCol,
        unitCol: unitCol === -1 ? nameCol + 1 : unitCol,
        priceCol,
        coeffCol,
        headerRow: r,
      };
    }
  }

  // Fallback: heuristic scan — find longest text col as name, first numeric col as price
  for (let r = 1; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    let nameCol = -1, priceCol = -1;
    let maxTextLen = 0;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val == null) continue;

      const str = String(val).trim();

      // Candidate for name: longest text
      if (typeof val === "string" || (str.length > 3 && isNaN(Number(str.replace(/[^\d.,]/g, ""))))) {
        if (str.length > maxTextLen) {
          maxTextLen = str.length;
          nameCol = c;
        }
      }

      // Candidate for price: positive number
      if (priceCol === -1 && c > 0) {
        const num = typeof val === "number" ? val : parseFloat(str.replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(num) && num > 0) {
          priceCol = c;
        }
      }
    }

    if (nameCol !== -1 && priceCol !== -1) {
      const unitCol = priceCol - 1 > nameCol ? priceCol - 1 : nameCol + 1;
      return { nameCol, unitCol, priceCol, coeffCol: -1, headerRow: r - 1 };
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

function parsePrice(raw: any): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const cleaned = String(raw)
    .replace(/\s/g, "")
    .replace(/[^\d.,\-]/g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parseCoeff(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw)
    .replace(/\s/g, "")
    .replace(/[^\d.,\-]/g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function isLikelySectionHeader(name: string, price: number, unit: string | null): boolean {
  // Section headers: no price, no unit, often short or numbered like "1.", "I.", "Раздел"
  if (price > 0) return false;
  const lower = name.toLowerCase();
  if (/^(раздел|глава|часть|блок|группа|категория)\s/i.test(name)) return true;
  if (/^\d+\.\s*$/.test(name.trim())) return true;
  if (!unit && price === 0 && name.length < 50) return true;
  return false;
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

    const startRow = cols.headerRow + 1;
    let currentSection = "";

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const name = String(row[cols.nameCol] || "").trim();
      if (!name || name.length < 2) continue;

      const rawUnit = row[cols.unitCol];
      const unit = detectUnit(rawUnit);
      const price = parsePrice(row[cols.priceCol]);
      const coeff = cols.coeffCol !== -1 ? parseCoeff(row[cols.coeffCol]) : null;

      // Detect section headers
      if (isLikelySectionHeader(name, price, rawUnit ? String(rawUnit).trim() : null)) {
        currentSection = name.replace(/^\d+[\.\)]\s*/, "").trim();
        continue;
      }

      // Build description from section context
      let description: string | null = null;
      if (currentSection) {
        description = `Раздел: ${currentSection}`;
      }
      if (coeff != null && coeff !== 1) {
        const coeffStr = `Коэффициент: ${coeff}`;
        description = description ? `${description}; ${coeffStr}` : coeffStr;
      }

      items.push({
        service_name: name,
        unit,
        price,
        description,
        coefficient: coeff,
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
