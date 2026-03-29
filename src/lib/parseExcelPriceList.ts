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

const NAME_HEADERS = [
  "наименование", "услуг", "название", "работ", "вид", "описание",
  "позиция", "наим", "перечень", "состав", "наименование работ",
  "наименование услуг", "виды работ", "вид работ", "перечень работ",
  "услуга", "работа", "наименование услуги",
];
const UNIT_HEADERS = ["ед.", "единиц", "изм", "ед.изм", "ед. изм", "единица"];
const PRICE_HEADERS = [
  "цена", "стоимость", "руб", "тариф", "расценка", "ставка",
  "прайс", "сумма", "₽", "rub", "цена за ед", "цена за единицу",
  "стоимость работ", "стоимость за ед", "за единицу", "за ед.",
];
const COEFF_HEADERS = ["коэф", "коэфф", "кф", "k", "множитель", "надбавка", "повыш", "понижающ"];
const SKIP_HEADERS = ["№", "п/п", "п.п", "п.п.", "n", "no", "номер", "num", "#"];

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

function isNumberColumn(val: string): boolean {
  return matchesAny(val, SKIP_HEADERS) || /^№/.test(val.trim());
}

function guessColumns(rows: any[][]): ColumnMap | null {
  if (rows.length < 2) return null;

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;

    let nameCol = -1, unitCol = -1, priceCol = -1, coeffCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = normalizeStr(row[c]);
      if (!val || val.length < 1) continue;

      if (isNumberColumn(val)) continue;

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
      return { nameCol, unitCol: unitCol === -1 ? nameCol + 1 : unitCol, priceCol, coeffCol, headerRow: r };
    }

    // If we found name but not price, try to find price column by looking for numeric values in data rows
    if (nameCol !== -1 && priceCol === -1) {
      for (let dr = r + 1; dr < Math.min(r + 5, rows.length); dr++) {
        const dataRow = rows[dr];
        if (!dataRow) continue;
        for (let c = 0; c < dataRow.length; c++) {
          if (c === nameCol || c === unitCol) continue;
          const v = dataRow[c];
          if (typeof v === "number" && v > 0 && v < 99999999) {
            priceCol = c;
            break;
          }
          if (v != null) {
            const n = parseFloat(String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
            if (!isNaN(n) && n > 0 && n < 99999999) {
              priceCol = c;
              break;
            }
          }
        }
        if (priceCol !== -1) break;
      }
      if (priceCol !== -1) {
        return { nameCol, unitCol: unitCol === -1 ? nameCol + 1 : unitCol, priceCol, coeffCol, headerRow: r };
      }
    }
  }

  // Fallback: scan data rows to find text col (name) and numeric col (price)
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    let nameCol = -1, priceCol = -1;
    let maxTextLen = 0;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val == null) continue;
      const str = String(val).trim();
      if (!str) continue;

      const numCleaned = str.replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
      const isNum = numCleaned.length > 0 && !isNaN(Number(numCleaned));

      if (!isNum && str.length > maxTextLen && str.length > 5) {
        maxTextLen = str.length;
        nameCol = c;
      }

      if (priceCol === -1 && c > 0 && isNum) {
        const num = parseFloat(numCleaned);
        if (num > 0 && num < 99999999) priceCol = c;
      }
    }

    if (nameCol !== -1 && priceCol !== -1) {
      // Verify by checking next rows too
      let confirmed = 0;
      for (let dr = r + 1; dr < Math.min(r + 4, rows.length); dr++) {
        const dataRow = rows[dr];
        if (!dataRow) continue;
        const nm = String(dataRow[nameCol] || "").trim();
        const pv = dataRow[priceCol];
        if (nm.length > 2 && pv != null) confirmed++;
      }
      if (confirmed >= 1) {
        const unitCol = priceCol - 1 > nameCol ? priceCol - 1 : nameCol + 1;
        return { nameCol, unitCol, priceCol, coeffCol: -1, headerRow: Math.max(0, r - 1) };
      }
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
  if (typeof raw === "number") {
    if (!isFinite(raw) || Math.abs(raw) > 99999999) return 0;
    return Math.round(raw * 100) / 100;
  }
  if (!raw) return 0;
  const cleaned = String(raw)
    .replace(/\s/g, "")
    .replace(/[^\d.,\-]/g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  if (!isFinite(num) || Math.abs(num) > 99999999) return 0;
  return Math.round(num * 100) / 100;
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

function isLikelySectionHeader(name: string, price: number, rawUnit: string | null, hasUnitCol: boolean): boolean {
  if (price > 0) return false;
  if (/^(раздел|глава|часть|блок|группа|категория)\s/i.test(name)) return true;
  if (/^\d+\.\s*$/.test(name.trim())) return true;
  // Only treat as header if there's a unit column in the table but this row has no unit AND no price
  if (hasUnitCol && !rawUnit && price === 0 && name.length < 30 && /^[IVX\d]+[\.\)]\s/.test(name)) return true;
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
    const hasUnitCol = cols.unitCol !== cols.nameCol + 1 || cols.unitCol !== -1;

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const name = String(row[cols.nameCol] || "").trim();
      if (!name || name.length < 2) continue;

      // Skip rows that look like the header row repeated
      const normName = normalizeStr(name);
      if (matchesAny(normName, NAME_HEADERS)) continue;

      const rawUnit = row[cols.unitCol];
      const rawUnitStr = rawUnit ? String(rawUnit).trim() : null;
      const unit = detectUnit(rawUnit);
      const price = parsePrice(row[cols.priceCol]);
      const coeff = cols.coeffCol !== -1 ? parseCoeff(row[cols.coeffCol]) : null;

      if (isLikelySectionHeader(name, price, rawUnitStr, hasUnitCol)) {
        currentSection = name.replace(/^\d+[\.\)]\s*/, "").replace(/^[IVX]+[\.\)]\s*/, "").trim();
        continue;
      }

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
