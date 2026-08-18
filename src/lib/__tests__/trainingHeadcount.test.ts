import { describe, it, expect } from 'vitest';
import { summariseHeadcount } from '../trainingHeadcount';
import type { ContestEntry, TrainingAttendance, TrainingSession } from '../types';

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'session-1',
    contest_id: 'contest-1',
    session_date: '2099-09-06',
    start_time: '14:00:00',
    end_time: '17:00:00',
    location: null,
    note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ContestEntry> = {}): ContestEntry {
  return {
    id: 'entry-1',
    contest_id: 'contest-1',
    student_id: 'student-1',
    parent_id: 'parent-1',
    grade: 'E4',
    student_name: '林小明',
    status: 'enrolled',
    admin_note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function makeMark(
  sessionId: string,
  entryId: string,
  status: TrainingAttendance['status']
): TrainingAttendance {
  return {
    id: `${sessionId}:${entryId}`,
    session_id: sessionId,
    entry_id: entryId,
    status,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  };
}

const PAST = makeSession({ id: 'past-1', session_date: '2020-01-01' });
const FUTURE = makeSession({ id: 'future-1' });
const FUTURE_2 = makeSession({ id: 'future-2', session_date: '2099-09-13' });

describe('summariseHeadcount', () => {
  /*
    「3 人」看不出是多是少，「3/10」才看得出。分母是這場比賽已錄取的
    孩子 —— 那是這個時段最多可能來幾個人。
  */
  it('錄取人數是每一場的分母', () => {
    const summary = summariseHeadcount(
      [FUTURE],
      [makeEntry(), makeEntry({ id: 'entry-2' })],
      []
    );

    expect(summary.enrolled).toBe(2);
  });

  /*
    點過名的也算 —— 有列就代表家長挑了這個時段，「未到」是事後的
    事實，不是他沒挑。
  */
  it('數出每一場有幾個人挑了，點過名的也算', () => {
    const summary = summariseHeadcount(
      [FUTURE],
      [makeEntry(), makeEntry({ id: 'entry-2' })],
      [
        makeMark('future-1', 'entry-1', 'signed_up'),
        makeMark('future-1', 'entry-2', 'absent'),
      ]
    );

    expect(summary.counts.get('future-1')).toBe(2);
  });

  it('沒有人挑的場次是 0，不是缺一格', () => {
    const summary = summariseHeadcount([FUTURE], [makeEntry()], []);
    expect(summary.counts.get('future-1')).toBe(0);
  });

  /*
    老莫要的是「望一眼就知道哪幾場該調時間」。長條能比出多寡，但真的
    需要動手的那幾場要自己跳出來 —— 門檻取平均的一半，因為低於平均
    的場次永遠佔一半，標起來等於沒標。
  */
  it('人不到平均一半的場次標成偏少', () => {
    const kids = [1, 2, 3, 4].map((n) =>
      makeEntry({ id: `entry-${n}`, student_name: `孩子${n}` })
    );
    const summary = summariseHeadcount(
      [FUTURE, FUTURE_2],
      kids,
      [
        // 第一場四個人都來，第二場只有一個 —— 平均 2.5，一半是 1.25
        ...kids.map((kid) => makeMark('future-1', kid.id, 'signed_up')),
        makeMark('future-2', 'entry-1', 'signed_up'),
      ]
    );

    expect(summary.lowSessionIds.has('future-2')).toBe(true);
    expect(summary.lowSessionIds.has('future-1')).toBe(false);
  });

  it('一個人都沒有的場次一定算偏少', () => {
    const summary = summariseHeadcount([FUTURE], [makeEntry()], []);
    expect(summary.lowSessionIds.has('future-1')).toBe(true);
  });

  /* 已經上完的場次改不了時間，標出來只是雜訊 */
  it('已經上完的不算偏少', () => {
    const summary = summariseHeadcount([PAST], [makeEntry()], []);
    expect(summary.lowSessionIds.size).toBe(0);
  });

  it('人數跟大家差不多的不算偏少', () => {
    const summary = summariseHeadcount(
      [FUTURE, FUTURE_2],
      [makeEntry(), makeEntry({ id: 'entry-2' })],
      [
        makeMark('future-1', 'entry-1', 'signed_up'),
        makeMark('future-1', 'entry-2', 'signed_up'),
        makeMark('future-2', 'entry-1', 'signed_up'),
      ]
    );

    // 平均 1.5，一半是 0.75 —— 一個人的那場不算冷清
    expect(summary.lowSessionIds.size).toBe(0);
  });

  it('沒有錄取的孩子時分母是 0，不會爆掉', () => {
    const summary = summariseHeadcount([FUTURE], [], []);
    expect(summary.enrolled).toBe(0);
    expect(summary.counts.get('future-1')).toBe(0);
  });
});
