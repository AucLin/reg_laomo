import type { TrainingSession } from './types';

export interface CalendarDay {
  /** YYYY-MM-DD。補在月初月末的空格是 null */
  date: string | null;
  /** 這一天的場次，早的排前面 */
  sessions: TrainingSession[];
}

export interface CalendarMonth {
  year: number;
  /** 1–12 */
  month: number;
  /** 每一列七格，從週日到週六 */
  weeks: CalendarDay[][];
}

/*
  把場次排進月曆。

  列表看得出「哪一場人少」，看不出「這一週都沒排」或「連著三天都排」。
  時間的疏密要用日曆才看得出來 —— 那正是要調時間時的依據。

  只畫有排課的月份：空月份是給人翻的，老莫要看的是這一期。

  日期一律用 UTC 建構再讀 UTC。直接 new Date('2026-08-01') 在台灣
  時區會被解讀成當地時間的午夜，某些日期會整個差一天。
*/
export function buildCalendar(sessions: TrainingSession[]): CalendarMonth[] {
  const byDate = new Map<string, TrainingSession[]>();
  for (const session of sessions) {
    const rows = byDate.get(session.session_date) ?? [];
    rows.push(session);
    byDate.set(session.session_date, rows);
  }
  for (const rows of byDate.values()) {
    rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const monthKeys = [...new Set([...byDate.keys()].map((date) => date.slice(0, 7)))].sort();

  return monthKeys.map((key) => {
    const [year, month] = key.split('-').map(Number);
    // 下個月的第 0 天就是這個月的最後一天
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

    const cells: CalendarDay[] = [];
    // 月初補空格，第一天才會落在對的星期底下
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, sessions: [] });
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${key}-${String(day).padStart(2, '0')}`;
      cells.push({ date, sessions: byDate.get(date) ?? [] });
    }
    // 補到整週，最後一列才不會缺角
    while (cells.length % 7 !== 0) cells.push({ date: null, sessions: [] });

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    /*
      裁掉頭尾沒排課的整週。一期集訓多半只佔月底那兩三週，把整個月
      畫出來就是幾百像素的空白把有課的部分往下推。

      中間的空白週要留著 —— 「這一週沒排」本身就是要看的東西。
    */
    const hasSession = (week: CalendarDay[]) =>
      week.some((day) => day.sessions.length > 0);
    let first = weeks.findIndex(hasSession);
    let last = weeks.length - 1;
    while (last > first && !hasSession(weeks[last])) last -= 1;
    if (first < 0) first = 0;

    return { year, month, weeks: weeks.slice(first, last + 1) };
  });
}
