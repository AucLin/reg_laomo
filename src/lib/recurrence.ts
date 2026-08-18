import type { TrainingSession } from './types';

/*
  把「從幾號到幾號、每週哪幾天」展開成一串日期。

  集訓通常是固定星期幾連上好幾週，一場一場填日期是把同一件事重打十遍。
  這裡只算日期，時間與備註由呼叫端補上 —— 整期共用同一組時間正是
  「排整期」的前提，哪一場要改再單獨改那一場。

  日期一律用 UTC 建構再讀 UTC：直接 new Date('2026-08-22') 在台灣時區會被
  解讀成當地時間的午夜，加減天數時某些日期會整個差一天。
*/
export function expandWeekdays(from: string, to: string, weekdays: number[]): string[] {
  if (from === '' || to === '' || weekdays.length === 0) return [];

  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < cursor) return [];

  const picked = new Set(weekdays);
  const dates: string[] = [];
  while (cursor <= end) {
    if (picked.has(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export interface SeriesForm {
  from: string;
  to: string;
  /** 0 是星期日，跟 Date.getUTCDay() 一致 */
  weekdays: number[];
  start_time: string;
  end_time: string;
}

export interface SeriesPlan {
  /** 這次會建出來的日期 */
  dates: string[];
  /** 已經排過、這次跳過的日期 */
  skipped: string[];
  error: string | null;
}

/*
  一次最多排幾場。補習班的一期集訓頂多十幾堂，六十場已經是一年份的週課
  —— 這個數字不是效能上限，是防手滑：把結束日期打成 2036 年，沒有這道
  檢查就會一口氣建出五百場，而刪除是一場一場刪的。
*/
export const MAX_SERIES_SESSIONS = 60;

/**
 * 把整期表單換算成「這次要建哪幾天」。
 *
 * 已經排過的日期會被挑出來跳過，不是報錯 —— 期中補排幾堂課時，管理員
 * 最自然的動作就是把原本的區間再送一次，只多勾一天。那時候應該只建
 * 新的那幾場，而不是要他先算出哪些還沒排。
 */
export function planSeries(form: SeriesForm, existing: TrainingSession[]): SeriesPlan {
  const empty = (error: string | null): SeriesPlan => ({ dates: [], skipped: [], error });

  if (form.from === '' || form.to === '') return empty('請選擇開始與結束日期');
  if (form.to < form.from) return empty('結束日期不能早於開始日期');
  if (form.weekdays.length === 0) return empty('請至少挑一個星期幾');
  if (form.start_time === '') return empty('請填寫開始時間');
  if (form.end_time === '') return empty('請填寫結束時間');
  if (form.end_time <= form.start_time) return empty('結束時間要晚於開始時間');

  const all = expandWeekdays(form.from, form.to, form.weekdays);
  if (all.length === 0) return empty('這段期間裡沒有你挑的星期幾');
  if (all.length > MAX_SERIES_SESSIONS) {
    return empty(`一次最多排 ${MAX_SERIES_SESSIONS} 場，這樣會排出 ${all.length} 場`);
  }

  // 同一天同一個開始時間就算排過了。資料庫存的是 HH:MM:SS，表單是 HH:MM
  const taken = new Set(
    existing.map((s) => `${s.session_date} ${s.start_time.slice(0, 5)}`)
  );
  const dates: string[] = [];
  const skipped: string[] = [];
  for (const date of all) {
    if (taken.has(`${date} ${form.start_time}`)) skipped.push(date);
    else dates.push(date);
  }

  if (dates.length === 0) return { dates, skipped, error: '這些時段都已經排過了' };
  return { dates, skipped, error: null };
}
