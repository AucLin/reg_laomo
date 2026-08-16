import { describe, it, expect } from 'vitest';
import { toCsv } from '../csv';
import type { AdminRegistrationRow } from '../types';

function makeRegistration(
  overrides: Partial<AdminRegistrationRow> = {}
): AdminRegistrationRow {
  return {
    id: 'reg-1',
    parent_id: 'parent-1',
    student_name: '林小明',
    student_gender: 'male',
    student_birthday: '2016-05-20',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E4',
    class_name: '忠班',
    parent_name: '林大明',
    relation: 'father',
    contact_phone: '0912345678',
    status: 'pending',
    admin_note: null,
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    school_name: '臺北市立中正國小',
    school_city: '臺北市',
    school_level: 'elementary',
    ...overrides,
  };
}

describe('toCsv', () => {
  it('開頭有位元組順序記號，Excel 開啟時中文才不會變亂碼', () => {
    const csv = toCsv([makeRegistration()]);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('第一行是繁體中文標題列', () => {
    const csv = toCsv([makeRegistration()]);
    const header = csv.replace('﻿', '').split('\n')[0];
    expect(header).toContain('學生姓名');
    expect(header).toContain('就讀學校');
    expect(header).toContain('聯絡電話');
    expect(header).toContain('狀態');
  });

  it('代碼欄位轉成可讀的中文', () => {
    const csv = toCsv([makeRegistration()]);
    expect(csv).toContain('男');
    expect(csv).toContain('父親');
    expect(csv).toContain('待審核');
    expect(csv).toContain('國小四年級');
  });

  it('含逗號的欄位用雙引號包起來', () => {
    const csv = toCsv([makeRegistration({ admin_note: '已致電,家長要求週末回覆' })]);
    expect(csv).toContain('"已致電,家長要求週末回覆"');
  });

  it('欄位內的雙引號改成兩個雙引號', () => {
    const csv = toCsv([makeRegistration({ admin_note: '家長說「要"確認"再說」' })]);
    expect(csv).toContain('""確認""');
  });

  it('沒選到名錄學校時匯出自由文字校名', () => {
    const csv = toCsv([
      makeRegistration({
        school_id: null,
        school_name_raw: '某某實驗教育機構',
        school_name: null,
        school_city: null,
        school_level: null,
      }),
    ]);
    expect(csv).toContain('某某實驗教育機構');
  });

  it('空值輸出成空字串而不是 null 字樣', () => {
    const csv = toCsv([makeRegistration({ class_name: null, admin_note: null })]);
    expect(csv).not.toContain('null');
    // 精準檢查：班級欄位與備註欄位應為空
    const lines = csv.replace('﻿', '').split('\n');
    const dataRow = lines[1]; // 第二行是資料
    const fields = dataRow.split(',');
    // 班級是第 8 個欄位（索引 7），備註是第 13 個欄位（索引 12）
    expect(fields[7]).toBe('');
    expect(fields[12]).toBe('');
  });

  it('沒有資料時仍輸出標題列', () => {
    const csv = toCsv([]);
    expect(csv.replace('﻿', '').split('\n')[0]).toContain('學生姓名');
  });

  it('含換行符的欄位用雙引號包起來', () => {
    const csv = toCsv([makeRegistration({ admin_note: '第一行\n第二行' })]);
    expect(csv).toContain('"第一行\n第二行"');
  });

  it('全形逗號在 CSV 是普通字元，不會被引號包住', () => {
    const csv = toCsv([makeRegistration({ admin_note: '已致電，沒人接' })]);
    // 全形逗號（U+FF0C）不是 CSV 分隔符，所以不需要跳脫
    // 這個欄位應該原樣出現，不含引號
    expect(csv).toContain('已致電，沒人接');
    expect(csv).not.toContain('"已致電，沒人接"');
  });
});
