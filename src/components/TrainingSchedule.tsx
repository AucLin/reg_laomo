import { useEffect, useState } from 'react';
import Spinner from './Spinner';
import {
  CalendarDoodle,
  CircleScribble,
  DashedRule,
  HandCheck,
  NoteFrame,
  Squiggle,
} from './doodles';
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

/** 拆成 9/6 與「六」兩截：日期塊上下兩行分開排 */
function splitDate(date: string): { md: string; weekday: string } {
  const [, month, day] = date.split('-').map(Number);
  // 用 UTC 建構再讀 UTC 的星期：直接 new Date('2026-09-06') 在台灣時區
  // 會被解讀成當地時間的午夜，某些日期會整個差一天
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return { md: `${month}/${day}`, weekday };
}

/*
  家長端的集訓時間表。

  管理員把時段排出來，家長從裡面挑孩子要上的那幾場 —— 挑了才算數，
  沒挑就是不來。這也是為什麼畫面上沒有「請假」：不來就不要挑，
  挑了又不來就取消。

  版面照日曆的樣子做：每一場左邊一塊日期，挑好的那幾天用筆圈起來。
  家長要回答的問題是「這幾天我家小孩哪幾天能來」，翻日曆正是他們
  本來就在做的事。

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
      <div className="flex items-start gap-3 sm:gap-4">
        <CalendarDoodle className="h-12 w-12 shrink-0 text-brand-600 sm:h-16 sm:w-16" />
        <div className="min-w-0">
          <div className="inline-block">
            <h2 className="text-2xl font-bold text-slate-900">集訓時間</h2>
            <Squiggle className="mt-1 text-amber-400" />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            請挑出孩子要來的時段，挑了我們才會準備位子。要改隨時都可以，課開始後就
            改不了，請直接打電話給我們。
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {byContest.map(({ contest, rows, kids }) => {
          /*
            自己挑了幾個時段。家長最常問的是「我挑完了嗎」，這個數字
            就是答案 —— 一個都沒挑時說得更直白一點。
          */
          const pickedCount = rows.reduce(
            (total, session) =>
              total +
              kids.filter((kid) =>
                marks.some(
                  (m) =>
                    m.session_id === session.id &&
                    m.entry_id === kid.id &&
                    m.status === 'signed_up'
                )
              ).length,
            0
          );

          return (
            <div
              key={contest.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{contest.title}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    pickedCount > 0
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {pickedCount > 0 ? `已挑 ${pickedCount} 個時段` : '還沒挑任何時段'}
                </span>
              </div>
              <DashedRule className="my-4 text-slate-300" />

              <ul className="space-y-3">
                {rows.map((session) => {
                  const past =
                    new Date(`${session.session_date}T${session.start_time}`) < new Date();
                  const { md, weekday } = splitDate(session.session_date);
                  // 這一天我家有人要去，日期就圈起來
                  const anyJoined = kids.some((kid) =>
                    marks.some(
                      (m) =>
                        m.session_id === session.id &&
                        m.entry_id === kid.id &&
                        m.status === 'signed_up'
                    )
                  );

                  return (
                    <li
                      key={session.id}
                      className={`rounded-2xl p-3 sm:p-4 ${
                        past ? 'bg-slate-50 opacity-70' : anyJoined ? 'bg-brand-50/60' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
                        {/* 日期塊。手機橫著擺，桌機立起來放左邊 */}
                        <div className="flex shrink-0 items-center gap-3 sm:w-20 sm:flex-col sm:gap-1.5">
                          <div className="relative flex h-16 w-16 shrink-0 flex-col items-center justify-center">
                            {anyJoined ? (
                              <span className="absolute -inset-1">
                                <CircleScribble className="text-brand-500" />
                              </span>
                            ) : (
                              <span className="absolute inset-0">
                                <NoteFrame
                                  className={past ? 'text-slate-300' : 'text-slate-400'}
                                />
                              </span>
                            )}
                            <span className="relative text-base font-bold text-slate-900">
                              {md}
                            </span>
                            <span className="relative text-[11px] text-slate-600">
                              （{weekday}）
                            </span>
                          </div>
                          <span className="tabular-nums text-sm text-slate-600 sm:text-center sm:text-xs">
                            {formatTime(session.start_time)}–{formatTime(session.end_time)}
                          </span>
                        </div>

                        <ul className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
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
                                className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ${
                                  joined ? 'ring-brand-200' : 'ring-slate-200'
                                }`}
                              >
                                <span className="font-medium text-slate-800">
                                  {kid.student_name}
                                </span>

                                {joined && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                                    <HandCheck className="h-3.5 w-3.5" />
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
                                        // 手機上是家長真的要按的東西，給到 44 高；
                                        // 桌機用滑鼠點，維持原本的密度
                                        joined
                                          ? 'rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 sm:px-3 sm:py-1.5'
                                          : 'rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:px-3 sm:py-1.5'
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
                      </div>

                      {session.note && (
                        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-100">
                          {session.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
