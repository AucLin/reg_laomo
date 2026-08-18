import {
  isSessionPast,
  type ContestEntry,
  type TrainingAttendance,
  type TrainingSession,
} from './types';

export interface HeadcountSummary {
  /** 已錄取的孩子數。每一場人數的分母 —— 沒有它，「3 人」看不出是多是少 */
  enrolled: number;
  /** 每一場有幾個人要來，鍵是場次 id */
  counts: Map<string, number>;
  /** 人少到該考慮改時間的場次。已經上完的不算 —— 改不了了 */
  lowSessionIds: Set<string>;
}

/*
  每一場有幾個人要來。

  老莫排完時段後要看的就是這件事：哪幾場有人、哪幾場沒人。人太少的
  那幾場可以改時間，把學生併到同一天補滿。

  點過名的也算進人數：有列就代表家長挑了這個時段，「未到」是上課
  當天的事實，不是他沒挑。
*/
export function summariseHeadcount(
  sessions: TrainingSession[],
  entries: ContestEntry[],
  attendance: TrainingAttendance[]
): HeadcountSummary {
  const counts = new Map<string, number>();
  for (const session of sessions) counts.set(session.id, 0);
  for (const row of attendance) {
    // 場次可能剛被刪掉，紀錄還在手上
    if (!counts.has(row.session_id)) continue;
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }

  const upcoming = sessions.filter((session) => !isSessionPast(session));
  const total = upcoming.reduce((sum, session) => sum + (counts.get(session.id) ?? 0), 0);
  // 沒有還能挑的場次時不能除以零
  const average = upcoming.length === 0 ? 0 : total / upcoming.length;

  /*
    哪幾場該考慮改時間。

    門檻是「不到同期平均的一半」而不是一個固定人數 —— 十個人的班跟
    三個人的班，冷清的定義不一樣。低於平均的場次永遠有一半，那樣標
    起來等於沒標，所以要少到一半以下才算。平均本身不寫在畫面上，
    它只是這個門檻的算法。

    一個人都沒有的一定算：那場不改時間就是白開。
  */
  const lowSessionIds = new Set(
    upcoming
      .filter((session) => {
        const count = counts.get(session.id) ?? 0;
        return count === 0 || count * 2 < average;
      })
      .map((session) => session.id)
  );

  return { enrolled: entries.length, counts, lowSessionIds };
}
