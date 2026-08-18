import { useEffect, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import Spinner from './Spinner';
import { DashedRule, Squiggle } from './doodles';
import { listMyEntries, listOpenContests } from '../lib/contests';
import {
  cancelTrainingSignup,
  listMyAttendance,
  listMySessions,
  signupTraining,
} from '../lib/training';
import {
  formatTime,
  type Contest,
  type ContestEntry,
  type TrainingAttendance,
  type TrainingSession,
} from '../lib/types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 9/6（六）。年份省掉 —— 集訓都在眼前這幾週，寫出來只是雜訊 */
function formatSessionDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  // 用 UTC 建構再讀 UTC 的星期：直接 new Date('2026-09-06') 在台灣時區
  // 會被解讀成當地時間的午夜，某些日期會整個差一天
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${month}/${day}（${weekday}）`;
}

/*
  家長端的集訓時間表。

  管理員把時段排出來，家長從裡面挑孩子要上的那幾場 —— 挑了才算數，
  沒挑就是不來。這也是為什麼畫面上沒有「請假」：不來就不要挑，
  挑了又不來就取消。

  資料是三份拼起來的：場次（列級權限已經限縮到自己孩子有份的比賽）、
  自己孩子的報名（誰是誰）、挑選紀錄（沒有列就代表沒挑）。三份都很小
  —— 一個補習班一次頂多幾十列 —— 所以一次全撈回來在前端對照，比為了
  這件事開一張檢視表划算。
*/
export default function TrainingSchedule() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [marks, setMarks] = useState<TrainingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 正在等網路回應的那一格，鍵是「場次 + 報名」
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listMySessions(),
      listMyEntries(),
      listOpenContests(),
      listMyAttendance(),
    ]).then(([s, e, c, a]) => {
      if (!active) return;
      setSessions(s);
      setEntries(e);
      setContests(c);
      setMarks(a);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(sessionId: string, entryId: string, joined: boolean) {
    const key = `${sessionId}:${entryId}`;
    setBusyKey(key);

    const { error: actionError } = joined
      ? await cancelTrainingSignup(sessionId, entryId)
      : await signupTraining(sessionId, entryId);

    if (actionError) {
      setError(actionError);
    } else {
      setError('');
      setMarks(await listMyAttendance());
    }
    setBusyKey(null);
  }

  if (loading) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <Spinner />
        正在讀取集訓時間…
      </p>
    );
  }

  // 沒排集訓的家長不該看到一塊空區塊
  if (sessions.length === 0) return null;

  const byContest = contests
    .map((contest) => ({
      contest,
      rows: sessions.filter((s) => s.contest_id === contest.id),
      /*
        只列錄取的孩子。集訓是錄取之後的事，還在審核的孩子挑了也沒用
        —— 資料庫的 signup_training() 會擋，那時家長只會看到一句
        錯誤訊息，不如一開始就不要給按。
      */
      kids: entries.filter(
        (e) => e.contest_id === contest.id && e.status === 'enrolled'
      ),
    }))
    .filter((group) => group.rows.length > 0 && group.kids.length > 0);

  if (byContest.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="inline-block">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <CalendarDays className="h-6 w-6 text-brand-600" aria-hidden="true" />
          集訓時間
        </h2>
        <Squiggle className="mt-1 text-amber-400" />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        請挑出孩子要來的時段，挑了我們才會準備位子。要改隨時都可以，課開始後就
        改不了，請直接打電話給我們。
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {byContest.map(({ contest, rows, kids }) => (
          <div
            key={contest.id}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6"
          >
            <h3 className="font-semibold text-slate-900">{contest.title}</h3>
            <DashedRule className="my-4 text-slate-300" />

            <ul className="space-y-4">
              {rows.map((session) => {
                const past =
                  new Date(`${session.session_date}T${session.start_time}`) < new Date();

                return (
                  <li key={session.id} className={past ? 'opacity-60' : ''}>
                    <p className="font-medium text-slate-800">
                      {formatSessionDate(session.session_date)}
                      {formatTime(session.start_time)}–{formatTime(session.end_time)}
                    </p>
                    {session.location && (
                      <p className="text-sm text-slate-600">{session.location}</p>
                    )}
                    {session.note && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                        {session.note}
                      </p>
                    )}

                    <ul className="mt-2 space-y-2">
                      {kids.map((kid) => {
                        const key = `${session.id}:${kid.id}`;
                        const mark = marks.find(
                          (m) => m.session_id === session.id && m.entry_id === kid.id
                        );
                        const joined = mark?.status === 'signed_up';
                        const busy = busyKey === key;

                        return (
                          <li
                            key={kid.id}
                            className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              joined ? 'bg-brand-50' : 'bg-slate-50'
                            }`}
                          >
                            <span className="font-medium text-slate-800">
                              {kid.student_name}
                            </span>

                            {joined && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                                <Check className="h-3 w-3" aria-hidden="true" />
                                會來
                              </span>
                            )}
                            {/* 點名結果是上課當天的事實，家長只能看 */}
                            {mark?.status === 'present' && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                已到
                              </span>
                            )}
                            {mark?.status === 'absent' && (
                              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                未到
                              </span>
                            )}

                            {/* 課開始後不給改：資料庫也擋著，這裡先收起來，
                                免得按了才被拒絕 */}
                            {!past && (
                              <span className="ml-auto flex items-center gap-2">
                                {busy && <Spinner className="h-4 w-4 text-slate-500" />}
                                <button
                                  type="button"
                                  onClick={() => toggle(session.id, kid.id, joined)}
                                  disabled={busy}
                                  className={
                                    joined
                                      ? 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60'
                                      : 'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60'
                                  }
                                >
                                  {joined ? '取消' : '這場要來'}
                                </button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
