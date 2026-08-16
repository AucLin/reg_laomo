import {
  GENDER_LABELS,
  RELATION_LABELS,
  STATUS_LABELS,
  formatGrade,
  type AdminRegistrationRow,
} from './types';

const HEADERS = [
  '送出時間',
  '學生姓名',
  '性別',
  '生日',
  '就讀學校',
  '縣市',
  '年級',
  '班級',
  '家長姓名',
  '與學生關係',
  '聯絡電話',
  '狀態',
  '內部備註',
];

/** 含逗號、雙引號或換行的欄位必須用雙引號包住，內部的雙引號要重複一次 */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(registrations: AdminRegistrationRow[]): string {
  const rows = registrations.map((item) => [
    new Date(item.created_at).toLocaleString('zh-TW'),
    item.student_name,
    GENDER_LABELS[item.student_gender],
    item.student_birthday,
    item.school_name ?? item.school_name_raw ?? '',
    item.school_city ?? '',
    formatGrade(item.grade),
    item.class_name ?? '',
    item.parent_name,
    RELATION_LABELS[item.relation],
    item.contact_phone,
    STATUS_LABELS[item.status],
    item.admin_note ?? '',
  ]);

  const lines = [HEADERS, ...rows].map((row) => row.map(escapeField).join(','));

  // 開頭的位元組順序記號是必要的：少了它，Excel 會用系統預設編碼解讀，
  // 中文全部變成亂碼，行政人員拿到檔案等於白做。
  return '﻿' + lines.join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
