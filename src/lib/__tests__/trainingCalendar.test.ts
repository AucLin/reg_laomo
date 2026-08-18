import { describe, it, expect } from 'vitest';
import { buildCalendar } from '../trainingCalendar';
import type { TrainingSession } from '../types';

function makeSession(
  id: string,
  session_date: string,
  start_time = '14:00:00'
): TrainingSession {
  return {
    id,
    contest_id: 'c1',
    session_date,
    start_time,
    end_time: '17:00:00',
    location: null,
    note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };
}

describe('buildCalendar', () => {
  it('沒有場次時沒有月份', () => {
    expect(buildCalendar([])).toEqual([]);
  });

  /* 只畫有排課的月份 —— 空月份是給人翻的，老莫要看的是這一期 */
  it('跨月時一個月一張', () => {
    const months = buildCalendar([
      makeSession('a', '2026-08-28'),
      makeSession('b', '2026-09-02'),
    ]);

    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 8],
      [2026, 9],
    ]);
  });

  it('月份由早到晚，跨年也照排', () => {
    const months = buildCalendar([
      makeSession('a', '2027-01-05'),
      makeSession('b', '2026-12-28'),
    ]);

    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 12],
      [2027, 1],
    ]);
  });

  /*
    2026-08-01 是週六，落在第一週的最後一格。整個八月只在 8/1 排課時
    就只剩那一週，前面五格仍要是空的，日子才落在對的星期底下。
  */
  it('月初補空格，第一天落在對的星期', () => {
    const [august] = buildCalendar([makeSession('a', '2026-08-01')]);

    expect(august.weeks[0].slice(0, 6).every((day) => day.date === null)).toBe(true);
    expect(august.weeks[0][6].date).toBe('2026-08-01');
  });

  it('每一週都是七格', () => {
    const [august] = buildCalendar([makeSession('a', '2026-08-18')]);
    expect(august.weeks.every((week) => week.length === 7)).toBe(true);
  });

  /*
    一期集訓多半只佔月底那兩三週。整個月畫出來就是幾百像素的空白，
    把有課的那幾天往下推。
  */
  it('頭尾沒排課的整週裁掉', () => {
    const [august] = buildCalendar([makeSession('a', '2026-08-18')]);
    const dates = august.weeks.flat().map((day) => day.date);

    // 8/18 那一週是 8/16–8/22
    expect(dates[0]).toBe('2026-08-16');
    expect(dates[dates.length - 1]).toBe('2026-08-22');
  });

  /* 中間空著的那一週要留著 —— 「這週沒排」本身就是要看的東西 */
  it('中間沒排課的週留著', () => {
    const [august] = buildCalendar([
      makeSession('a', '2026-08-03'),
      makeSession('b', '2026-08-19'),
    ]);

    expect(august.weeks).toHaveLength(3);
    expect(august.weeks[1].every((day) => day.sessions.length === 0)).toBe(true);
  });

  /* 同一天可以排兩場，早的排前面 */
  it('同一天多場放同一格，依時間排序', () => {
    const [august] = buildCalendar([
      makeSession('late', '2026-08-20', '16:00:00'),
      makeSession('early', '2026-08-20', '13:00:00'),
    ]);

    const day = august.weeks.flat().find((d) => d.date === '2026-08-20');
    expect(day?.sessions.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('沒排課的日子格子是空的', () => {
    const [august] = buildCalendar([makeSession('a', '2026-08-18')]);
    const day = august.weeks.flat().find((d) => d.date === '2026-08-19');
    expect(day?.sessions).toEqual([]);
  });

  it('同一週的日子都在，只是沒有場次', () => {
    const [august] = buildCalendar([makeSession('a', '2026-08-18')]);
    const dates = august.weeks.flat().filter((day) => day.date !== null);
    expect(dates).toHaveLength(7);
  });
});
