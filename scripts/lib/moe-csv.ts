export type SchoolLevel = 'elementary' | 'junior' | 'senior';

export interface ParsedSchool {
  code: string;
  name: string;
  level: SchoolLevel;
  city: string;
  address: string;
  phone: string;
}

/**
 * 教育部資料的縣市與地址欄位開頭帶著方括號代碼，例如
 * 「[01]新北市」或「[234]新北市永和區…」，一律剝掉只留可讀文字。
 */
export function stripBracketPrefix(value: string): string {
  return value.trim().replace(/^\[[^\]]*\]/, '').trim();
}

/**
 * 三個教育部檔案的欄位順序不一致，這是匯入最容易踩的坑：
 *   國小 e1_new.csv   8 欄：學年度, 代碼, 校名, 公/私立, 縣市, 地址, 電話, 網址
 *   高中 high.csv     9 欄：學年度, 代碼, 校名, 公/私立, 縣市, 地址, 電話, 網址, 備註
 *   國中 j1_new.csv   7 欄：      代碼, 校名, 公/私立, 縣市, 地址, 電話, 網址
 * 國中檔沒有學年度欄，所有欄位往前位移一格。
 */
const COLUMN_OFFSET: Record<SchoolLevel, number> = {
  elementary: 1,
  senior: 1,
  junior: 0,
};

/** 解析單行 CSV，正確處理被雙引號包住、內含逗號的欄位 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // 連續兩個雙引號代表一個實際的雙引號字元
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields.map((field) => field.trim());
}

export function parseMoeCsv(content: string, level: SchoolLevel): ParsedSchool[] {
  // 去掉位元組順序記號，否則第一個欄位會多出看不見的字元
  const clean = content.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/);
  const offset = COLUMN_OFFSET[level];
  const schools: ParsedSchool[] = [];

  // 第一行是標題列，從第二行開始
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    const fields = splitCsvLine(line);
    const code = fields[offset] ?? '';
    const name = fields[offset + 1] ?? '';

    // 代碼或校名缺一不可，缺了就是壞資料，跳過
    if (code === '' || name === '') continue;

    schools.push({
      code,
      name,
      level,
      city: stripBracketPrefix(fields[offset + 3] ?? ''),
      address: stripBracketPrefix(fields[offset + 4] ?? ''),
      phone: (fields[offset + 5] ?? '').trim(),
    });
  }

  return schools;
}
