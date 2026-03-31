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
  "наименование", "услуг", "название", "работ", "вид",
  "позиция", "наим", "перечень", "состав", "наименование работ",
  "наименование услуг", "виды работ", "вид работ", "перечень работ",
  "услуга", "работа", "наименование услуги", "содержание работ",
  "содержание", "вид услуг", "тип работ", "тип услуг",
  "описание", "описание работ", "описание услуг", "прейскурант",
  "виды услуг", "перечень услуг", "позиции", "наименования",
];
const UNIT_HEADERS = ["ед.", "единиц", "изм", "ед.изм", "ед. изм", "единица", "ед.измер"];
const PRICE_HEADERS = [
  "цена", "стоимость", "руб", "тариф", "расценка", "ставка",
  "прайс", "сумма", "₽", "rub", "цена за ед", "цена за единицу",
  "стоимость работ", "стоимость за ед", "за единицу", "за ед.",
  "price", "cost", "rate",
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

/** Try to detect if a row looks like a header row */
function isHeaderRow(row: any[]): boolean {
  if (!row) return false;
  let matches = 0;
  let hasName = false;
  for (const cell of row) {
    const v = normalizeStr(cell);
    if (!v) continue;
    if (matchesAny(v, NAME_HEADERS)) { matches++; hasName = true; }
    else if (matchesAny(v, UNIT_HEADERS) || matchesAny(v, PRICE_HEADERS) ||
             matchesAny(v, COEFF_HEADERS) || isNumberColumn(v)) {
      matches++;
    }
  }
  // Accept if 2+ matches, OR if name header found alone (price col inferred from data)
  return matches >= 2 || hasName;
}

function findPriceColFromData(rows: any[][], startRow: number, excludeCols: number[]): number {
  const colScores: Record<number, number> = {};
  for (let r = startRow; r < Math.min(startRow + 10, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (excludeCols.includes(c)) continue;
      const v = row[c];
      if (v == null) continue;
      let num: number;
      if (typeof v === "number") {
        num = v;
      } else {
        const s = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
        num = parseFloat(s);
      }
      if (!isNaN(num) && num > 0 && num < 99999999) {
        colScores[c] = (colScores[c] || 0) + 1;
      }
    }
  }
  let bestCol = -1, bestScore = 0;
  for (const [col, score] of Object.entries(colScores)) {
    if (score > bestScore) { bestScore = score; bestCol = Number(col); }
  }
  return bestScore >= 2 ? bestCol : -1;
}

function guessColumns(rows: any[][]): ColumnMap | null {
  if (rows.length < 2) return null;

  // Pass 1: Find header row by keyword matching (scan up to 50 rows)
  for (let r = 0; r < Math.min(50, rows.length); r++) {
    const row = rows[r];
    if (!row || !isHeaderRow(row)) continue;

    let nameCol = -1, unitCol = -1, priceCol = -1, coeffCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = normalizeStr(row[c]);
      if (!val || val.length < 1) continue;
      if (isNumberColumn(val)) continue;

      if (nameCol === -1 && matchesAny(val, NAME_HEADERS)) nameCol = c;
      else if (unitCol === -1 && matchesAny(val, UNIT_HEADERS)) unitCol = c;
      else if (priceCol === -1 && matchesAny(val, PRICE_HEADERS)) priceCol = c;
      else if (coeffCol === -1 && matchesAny(val, COEFF_HEADERS)) coeffCol = c;
    }

    if (nameCol !== -1 && priceCol !== -1) {
      return { nameCol, unitCol: unitCol === -1 ? nameCol + 1 : unitCol, priceCol, coeffCol, headerRow: r };
    }

    // Found name header but no price header — infer price column from data
    if (nameCol !== -1) {
      const exclude = [nameCol];
      if (unitCol !== -1) exclude.push(unitCol);
      priceCol = findPriceColFromData(rows, r + 1, exclude);
      if (priceCol !== -1) {
        return { nameCol, unitCol: unitCol === -1 ? nameCol + 1 : unitCol, priceCol, coeffCol, headerRow: r };
      }
    }
  }

  // Pass 2: No header row found. Heuristic — find columns by data patterns.
  // Find the column with the longest text strings (name) and the column with positive numbers (price).
  const colTextLen: Record<number, number[]> = {};
  const colNumVals: Record<number, number[]> = {};
  const scanEnd = Math.min(60, rows.length);

  for (let r = 0; r < scanEnd; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null) continue;
      const s = String(v).trim();
      if (!s) continue;

      const numCleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
      const numVal = parseFloat(numCleaned);
      const isLikelyNum = !isNaN(numVal) && numCleaned.length > 0 && numCleaned.length >= s.replace(/\s/g, "").length * 0.5;

      if (!isLikelyNum && s.length > 3) {
        if (!colTextLen[c]) colTextLen[c] = [];
        colTextLen[c].push(s.length);
      }
      if (isLikelyNum && numVal > 0 && numVal < 99999999) {
        if (!colNumVals[c]) colNumVals[c] = [];
        colNumVals[c].push(numVal);
      }
    }
  }

  // Best name col: most text entries with high average length
  let bestNameCol = -1, bestNameScore = 0;
  for (const [col, lengths] of Object.entries(colTextLen)) {
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const score = lengths.length * avg;
    if (score > bestNameScore && lengths.length >= 3) {
      bestNameScore = score;
      bestNameCol = Number(col);
    }
  }

  // Best price col: most numeric entries, excluding name col
  let bestPriceCol = -1, bestPriceCount = 0;
  for (const [col, vals] of Object.entries(colNumVals)) {
    if (Number(col) === bestNameCol) continue;
    if (vals.length > bestPriceCount) {
      bestPriceCount = vals.length;
      bestPriceCol = Number(col);
    }
  }

  if (bestNameCol !== -1 && bestPriceCol !== -1 && bestPriceCount >= 2) {
    // Find which row data starts — first row where both name and price have values
    let headerRow = 0;
    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;
      const nm = String(row[bestNameCol] || "").trim();
      const pv = row[bestPriceCol];
      if (nm.length > 3 && pv != null) {
        headerRow = Math.max(0, r - 1);
        break;
      }
    }

    const unitCol = bestPriceCol - 1 > bestNameCol ? bestPriceCol - 1 : bestNameCol + 1;
    return { nameCol: bestNameCol, unitCol, priceCol: bestPriceCol, coeffCol: -1, headerRow };
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
  let s = String(raw).trim();

  // Handle "от X" or "от X до Y" patterns
  const rangeMatch = s.match(/от\s*([\d\s.,]+).*?до\s*([\d\s.,]+)/i);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(/\s/g, "").replace(",", "."));
    const b = parseFloat(rangeMatch[2].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(a) && !isNaN(b)) return Math.round(((a + b) / 2) * 100) / 100;
  }
  const fromMatch = s.match(/от\s*([\d\s.,]+)/i);
  if (fromMatch) {
    const n = parseFloat(fromMatch[1].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 99999999) return Math.round(n * 100) / 100;
  }

  const cleaned = s.replace(/\s/g, "").replace(/[^\d.,\-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (!isFinite(num) || Math.abs(num) > 99999999) return 0;
  return Math.round(num * 100) / 100;
}

function parseCoeff(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const cleaned = String(raw).replace(/\s/g, "").replace(/[^\d.,\-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Extract coefficient from service name text like "(к=1.5)" or "(+20%)" */
function extractCoeffFromName(name: string): { cleanName: string; coeff: number | null } {
  let coeff: number | null = null;

  // Match patterns like "к=1.5", "коэф. 1.2", "x1.5"
  const coeffMatch = name.match(/\(?(?:к|коэф\.?|коэфф\.?)\s*[=:.]?\s*([\d.,]+)\)?/i);
  if (coeffMatch) {
    coeff = parseFloat(coeffMatch[1].replace(",", "."));
    const cleanName = name.replace(coeffMatch[0], "").trim();
    return { cleanName, coeff: isNaN(coeff) ? null : coeff };
  }

  // Match percentage patterns like "+20%", "(надбавка 30%)"
  const pctMatch = name.match(/\(?\+?\s*(\d+)\s*%\s*(надбавк[аи]?)?\)?/i);
  if (pctMatch) {
    const pct = parseInt(pctMatch[1]);
    if (pct > 0 && pct < 500) {
      coeff = 1 + pct / 100;
      const cleanName = name.replace(pctMatch[0], "").trim();
      return { cleanName, coeff };
    }
  }

  // Match "x1.5" or "×1.5"
  const xMatch = name.match(/[xх×]\s*([\d.,]+)/i);
  if (xMatch) {
    coeff = parseFloat(xMatch[1].replace(",", "."));
    const cleanName = name.replace(xMatch[0], "").trim();
    return { cleanName, coeff: isNaN(coeff) ? null : coeff };
  }

  return { cleanName: name, coeff: null };
}

function isLikelySectionHeader(name: string, price: number, rawUnit: string | null, hasUnitCol: boolean): boolean {
  if (price > 0) return false;
  if (/^(раздел|глава|часть|блок|группа|категория)\s*[:\-.]?\s/i.test(name)) return true;
  if (/^\d+\.\s*$/.test(name.trim())) return true;
  if (/^[IVX]+\.\s*$/.test(name.trim())) return true;
  if (hasUnitCol && !rawUnit && price === 0 && name.length < 25 && /^[IVX\d]+[\.\)]\s/.test(name) && !/\d{2,}/.test(name.replace(/^[IVX\d]+[\.\)]\s*/, ""))) return true;
  return false;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value) || /[\w.-]+\.(com|ru|net|org|dev|io|info)(\/|$)/i.test(value);
}

function looksLikeDateValue(value: any): boolean {
  if (value instanceof Date) return true;
  const text = String(value || "").trim();
  if (!text) return false;
  if (/(gmt|utc|mon|tue|wed|thu|fri|sat|sun|янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек|пон|вто|сре|чет|пят|суб|вос)/i.test(text)) return true;
  return /\b(19|20)\d{2}\b/.test(text) && !Number.isNaN(Date.parse(text));
}

function isNoiseServiceName(name: string): boolean {
  const normalized = normalizeStr(name);
  if (!normalized) return true;
  if (looksLikeUrl(name) || looksLikeDateValue(name)) return true;
  if (/^[\d\s.,₽$€%+-]+$/.test(name)) return true;
  if (/^т\d+[\d.,\s]*₽?$/i.test(normalized)) return true;

  const blockedPhrases = [
    "донат", "сумма на ваше усмотрение", "условная единица", "выбрать государство", "россия",
    "сбер", "сбербанк", "т-банк", "тинькофф", "озон-банк", "ozon", "qr", "сбп",
    "если плоды этого труда являются полезными", "messenger.online.sberbank.ru",
    "васкецов", "александр владимирович", "банк", "finance.ozon", "tbank.ru",
  ];

  if (blockedPhrases.some((phrase) => normalized.includes(phrase))) return true;
  if (!/[a-zа-яё]/i.test(name)) return true;

  // Looks like a person's full name (2-3 words, each capitalized, no service keywords)
  const words = name.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 3 && words.every(w => /^[А-ЯЁA-Z][а-яёa-z]+$/.test(w))) {
    // Could be a person name — check it doesn't contain service-like words
    const serviceHints = ["монтаж", "демонтаж", "мойка", "чистка", "ремонт", "покраска", "установка", "обслуживание", "работ"];
    if (!serviceHints.some(h => normalized.includes(h))) return true;
  }

  return false;
}

function isLikelyServiceSheet(rows: any[][], cols: ColumnMap): { isService: boolean; reason: string } {
  const startRow = cols.headerRow + 1;
  let validRows = 0;
  let noiseRows = 0;
  let coeffLikePrices = 0;
  let totalPrices = 0;
  let largePrices = 0;

  for (let r = startRow; r < Math.min(startRow + 120, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;

    const rawName = row[cols.nameCol];
    const name = String(rawName || "").trim();
    if (!name) continue;
    if (matchesAny(normalizeStr(name), NAME_HEADERS)) continue;

    const price = parsePrice(row[cols.priceCol]);
    const rawUnit = cols.unitCol >= 0 ? row[cols.unitCol] : null;
    const rawUnitStr = rawUnit ? String(rawUnit).trim() : "";
    const coeff = cols.coeffCol !== -1 ? parseCoeff(row[cols.coeffCol]) : null;

    if (price > 0) {
      totalPrices++;
      if (price >= 0.1 && price <= 5.0) coeffLikePrices++;
      if (price > 10) largePrices++;
    }

    if (isNoiseServiceName(name) || isLikelySectionHeader(name, price, rawUnitStr || null, cols.unitCol >= 0 && cols.unitCol !== cols.nameCol)) {
      noiseRows++;
      continue;
    }

    if (price > 0 || rawUnitStr || coeff != null) {
      validRows++;
    }
  }

  // If most prices look like coefficients (0.1-5.0) AND no large prices exist, this is a coefficient sheet
  if (totalPrices >= 5 && coeffLikePrices / totalPrices > 0.7 && largePrices === 0) {
    return { isService: false, reason: `coeff-like prices (${coeffLikePrices}/${totalPrices} in 0.1-5.0 range, 0 large)` };
  }

  if (validRows < 2) {
    return { isService: false, reason: `too few valid rows (${validRows}), noise=${noiseRows}` };
  }
  if (validRows < noiseRows * 0.5) {
    return { isService: false, reason: `noise dominates (valid=${validRows}, noise=${noiseRows})` };
  }

  return { isService: true, reason: `valid=${validRows}, noise=${noiseRows}, prices=${totalPrices}` };
}

function isCoefficientSheet(rows: any[][]): boolean {
  if (rows.length < 2) return false;

  let cityLikeRows = 0;
  let serviceLikeRows = 0;
  // Scan up to 200 rows to handle large city lists
  const scanEnd = Math.min(200, rows.length);

  for (let r = 0; r < scanEnd; r++) {
    const row = rows[r];
    if (!row) continue;

    const texts: string[] = [];
    const nums: number[] = [];

    for (const cell of row) {
      if (cell == null) continue;
      if (typeof cell === "number") nums.push(cell);
      else {
        const s = String(cell).trim();
        if (s.length > 0) texts.push(s);
      }
    }

    if (texts.length === 0 && nums.length === 0) continue;

    const hasShortText = texts.some((t) => t.length >= 2 && t.length <= 40 && !isNoiseServiceName(t));
    const hasCoeffNumbers = nums.some((n) => n >= 0.1 && n <= 5.0);
    const hasLargeNumbers = nums.some((n) => n > 10);
    const hasLongText = texts.some((t) => t.length > 50);

    if (hasShortText && hasCoeffNumbers && !hasLargeNumbers && !hasLongText) cityLikeRows++;
    if (hasLongText || hasLargeNumbers) serviceLikeRows++;
  }

  const total = cityLikeRows + serviceLikeRows;
  if (total < 3) return false;
  // If 50%+ rows look like city+coeff, treat as coefficient sheet
  return cityLikeRows / total > 0.5;
}

function isCoeffSheetByName(name: string): boolean {
  const n = name.toLowerCase().trim();
  const coeffKeywords = ["коэф", "коэфф", "кф", "город", "регион", "район", "зон", "территор", "надбавк", "индекс"];
  return coeffKeywords.some((k) => n.includes(k));
}

function extractCityCoefficients(rows: any[][]): Record<string, number> {
  const result: Record<string, number> = {};

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    let cityName = "";
    let coeffValue = 0;

    for (const cell of row) {
      if (cell == null) continue;
      if (typeof cell === "number" && cell >= 0.1 && cell <= 5.0) {
        coeffValue = cell;
      } else {
        const s = String(cell).trim();
        if (
          s.length >= 2 &&
          s.length <= 50 &&
          !isNoiseServiceName(s) &&
          !matchesAny(normalizeStr(s), [...COEFF_HEADERS, ...PRICE_HEADERS, ...UNIT_HEADERS, ...SKIP_HEADERS])
        ) {
          if (!cityName) cityName = s;
        }
      }
    }

    if (cityName && coeffValue > 0) result[cityName] = coeffValue;
  }

  return result;
}

function unmergeSheet(sheet: XLSX.WorkSheet) {
  if (sheet["!merges"]) {
    for (const merge of sheet["!merges"]) {
      const topLeft = sheet[XLSX.utils.encode_cell(merge.s)];
      if (!topLeft) continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!sheet[addr]) sheet[addr] = { ...topLeft };
        }
      }
    }
  }
}

export async function parseExcelFile(file: File): Promise<ParsedPriceItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const items: ParsedPriceItem[] = [];
  let cityCoefficients: Record<string, number> = {};

  const serviceSheets: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    unmergeSheet(sheet);
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (isCoeffSheetByName(sheetName) || isCoefficientSheet(rows)) {
      const coeffs = extractCityCoefficients(rows);
      cityCoefficients = { ...cityCoefficients, ...coeffs };
    } else {
      serviceSheets.push(sheetName);
    }
  }

  for (const sheetName of serviceSheets) {
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 2) continue;

    const cols = guessColumns(rows);
    if (!cols) {
      console.warn(`[parseExcel] Sheet "${sheetName}": could not detect columns`);
      continue;
    }
    if (!isLikelyServiceSheet(rows, cols)) {
      console.warn(`[parseExcel] Sheet "${sheetName}": failed service sheet validation — checking if coefficient sheet`);
      // This sheet might be a coefficient sheet that wasn't caught by name/pattern
      const coeffs = extractCityCoefficients(rows);
      if (Object.keys(coeffs).length >= 3) {
        console.log(`[parseExcel] Sheet "${sheetName}": detected as coefficient sheet (${Object.keys(coeffs).length} entries)`);
        cityCoefficients = { ...cityCoefficients, ...coeffs };
        continue;
      }
      if (rows.length < 10) continue;
    }

    const startRow = cols.headerRow + 1;
    let currentSection = "";
    const hasUnitCol = cols.unitCol >= 0 && cols.unitCol !== cols.nameCol;

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      let name = String(row[cols.nameCol] || "").trim();
      if (!name || name.length < 2 || isNoiseServiceName(name)) continue;

      const normName = normalizeStr(name);
      if (matchesAny(normName, NAME_HEADERS)) continue;

      const rawUnit = row[cols.unitCol];
      const rawUnitStr = rawUnit ? String(rawUnit).trim() : null;
      const unit = detectUnit(rawUnit);
      const price = parsePrice(row[cols.priceCol]);
      let coeff = cols.coeffCol !== -1 ? parseCoeff(row[cols.coeffCol]) : null;

      if (coeff == null) {
        const extracted = extractCoeffFromName(name);
        if (extracted.coeff != null) {
          coeff = extracted.coeff;
          name = extracted.cleanName;
        }
      }

      if (!name || isNoiseServiceName(name)) continue;

      if (isLikelySectionHeader(name, price, rawUnitStr, hasUnitCol)) {
        currentSection = name.replace(/^\d+[\.\)]\s*/, "").replace(/^[IVX]+[\.\)]\s*/, "").trim();
        continue;
      }

      let description: string | null = null;
      if (currentSection) description = `Раздел: ${currentSection}`;
      if (coeff != null && coeff !== 1) {
        const coeffStr = `Коэффициент: ${coeff}`;
        description = description ? `${description}; ${coeffStr}` : coeffStr;
      }

      items.push({ service_name: name, unit, price, description, coefficient: coeff });
    }
  }

  if (Object.keys(cityCoefficients).length > 0) {
    const coeffSummary = Object.entries(cityCoefficients)
      .map(([city, coeff]) => `${city}: ${coeff}`)
      .join(", ");

    for (const item of items) {
      if (!item.description) item.description = `Региональные коэффициенты: ${coeffSummary}`;
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
