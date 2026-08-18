import { describe, it, expect } from 'vitest';
import { expandWeekdays, planSeries, MAX_SERIES_SESSIONS } from '../recurrence';
import type { TrainingSession } from '../types';

function session(date: string, start = '14:00:00'): TrainingSession {
  return {
    id: `s-${date}-${start}`,
    contest_id: 'contest-1',
    session_date: date,
    start_time: start,
    end_time: '17:00:00',
    location: null,
    note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };
}

const FORM = {
  from: '2026-08-22',
  to: '2026-09-12',
  weekdays: [6],
  start_time: '14:00',
  end_time: '17:00',
};

describe('expandWeekdays', () => {
  it('挑出區間內的每個星期六', () => {
    expect(expandWeekdays('2026-08-22', '2026-09-12', [6])).toEqual([
      '2026-08-22',
      '2026-08-29',
      '2026-09-05',
      '2026-09-12',
    ]);
  });

  it('一次挑兩天時照日期先後排，不是先排完週三再排週六', () => {
    expect(expandWeekdays('2026-08-22', '2026-09-02', [3, 6])).toEqual([
      '2026-08-22',
      '2026-08-26',
      '2026-08-29',
      '2026-09-02',
    ]);
  });

  it('起訖同一天且剛好命中時只有那一天', () => {
    expect(expandWeekdays('2026-08-22', '2026-08-22', [6])).toEqual(['2026-08-22']);
  });

  it('起訖同一天但沒命中時是空的', () => {
    expect(expandWeekdays('2026-08-22', '2026-08-22', [1])).toEqual([]);
  });

  /*
    跨月跨年是最容易寫錯的地方 —— 用 setDate(getDate() + 1) 加天數時
    月底與年底都靠 Date 自己進位，這裡把它釘住。
  */
  it('跨年照樣接得上', () => {
    expect(expandWeekdays('2026-12-28', '2027-01-06', [1])).toEqual([
      '2026-12-28',
      '2027-01-04',
    ]);
  });

  it('結束早於開始時是空的，不會反著跑', () => {
    expect(expandWeekdays('2026-09-12', '2026-08-22', [6])).toEqual([]);
  });

  it('沒挑星期幾時是空的', () => {
    expect(expandWeekdays('2026-08-22', '2026-09-12', [])).toEqual([]);
  });
});

describe('planSeries', () => {
  it('算出整期要建的日期', () => {
    const plan = planSeries(FORM, []);
    expect(plan.error).toBeNull();
    expect(plan.dates).toHaveLength(4);
    expect(plan.skipped).toEqual([]);
  });

  /*
    期中補排時管理員最自然的動作是把原本的區間再送一次，只多勾一天。
    那時候該只建新的那幾場，而不是要他自己算出哪些還沒排。
  */
  it('已經排過的日期跳過，只建剩下的', () => {
    const plan = planSeries(FORM, [session('2026-08-22'), session('2026-09-05')]);
    expect(plan.dates).toEqual(['2026-08-29', '2026-09-12']);
    expect(plan.skipped).toEqual(['2026-08-22', '2026-09-05']);
    expect(plan.error).toBeNull();
  });

  it('同一天但不同時間不算排過 —— 早上一段下午一段是兩場', () => {
    const plan = planSeries(FORM, [session('2026-08-22', '09:00:00')]);
    expect(plan.dates).toContain('2026-08-22');
    expect(plan.skipped).toEqual([]);
  });

  it('整期都排過時說清楚，不是靜靜地建立 0 場', () => {
    const existing = ['2026-08-22', '2026-08-29', '2026-09-05', '2026-09-12'].map((d) =>
      session(d)
    );
    expect(planSeries(FORM, existing).error).toBe('這些時段都已經排過了');
  });

  it('沒挑星期幾要擋', () => {
    expect(planSeries({ ...FORM, weekdays: [] }, []).error).toBe('請至少挑一個星期幾');
  });

  it('結束日期早於開始日期要擋', () => {
    expect(planSeries({ ...FORM, to: '2026-08-01' }, []).error).toBe(
      '結束日期不能早於開始日期'
    );
  });

  it('結束時間不晚於開始時間要擋', () => {
    expect(planSeries({ ...FORM, end_time: '14:00' }, []).error).toBe(
      '結束時間要晚於開始時間'
    );
  });

  it('區間裡沒有那個星期幾時，訊息要講得出原因', () => {
    const plan = planSeries({ ...FORM, from: '2026-08-24', to: '2026-08-26' }, []);
    expect(plan.error).toBe('這段期間裡沒有你挑的星期幾');
  });

  /*
    把結束日期打成十年後不該一口氣建出幾百場 —— 刪除是一場一場刪的。
  */
  it('超過上限時擋下來並說出會排幾場', () => {
    const plan = planSeries({ ...FORM, to: '2036-08-22' }, []);
    expect(plan.dates).toEqual([]);
    expect(plan.error).toContain(`最多排 ${MAX_SERIES_SESSIONS} 場`);
  });
});
