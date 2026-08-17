import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Spinner from './Spinner';
import { DashedRule, Squiggle } from './doodles';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import { listMyEntries, listOpenContests } from '../lib/contests';
import {
  cancelLeave,
  listMyAttendance,
  listMySessions,
  requestLeave,
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

  資料是三份拼起來的：場次（列級權限已經限縮到自己孩子有份的比賽）、
  自己孩子的報名（誰是誰）、出缺席（沒有列就代表還沒點名也沒請假）。
  三份都很小 —— 一個補習班一次頂多幾十列 —— 所以一次全撈回來在前端
  對照，比為了這件事開一張檢視表划算。
*/
export default function TrainingSchedule() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [marks, setMarks] = useState<TrainingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 正在填請假原因的那一格，鍵是「場次 + 報名」
  const [leaveFor, setLeaveFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reasonIme = useImeGuardedInput(setReason);

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

  async function refresh() {
    setMarks(await listMyAttendance());
  }

  async function submitLeave(sessionId: string, entryId: string) {
    const key = `${sessionId}:${entryId}`;
    setBusyKey(key);
    const { error: leaveError } = await requestLeave(sessionId, entryId, reason);
    if (leaveError) {
      setError(leaveError);
    } else {
      setError('');
      setLeaveFor(null);
      setReason('');
      await refresh();
    }
    setBusyKey(null);
  }

  async function undoLeave(sessionId: string, entryId: string) {
    const key = `${sessionId}:${entryId}`;
    setBusyKey(key);
    const { error: cancelError } = await cancelLeave(sessionId, entryId);
    if (cancelError) setError(cancelError);
    else {
      setError('');
      await refresh();
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
      kids: entries.filter(
        (e) => e.contest_id === contest.id && e.status !== 'cancelled'
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
        來不了請提前按「請假」，我們就不會空等。課開始後就改不了，請直接打電話給我們。
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
                const past = new Date(`${session.session_date}T${session.start_time}`) < new Date();

                return (
                  <li key={session.id} className={past ? 'opacity-60' : ''}>
                    <p className="font-medium text-slate-800">
                      {formatSessionDate(session.session_date)}
                      {formatTime(session.start_time)}–{formatTime(session.end_time)}
                    </p>
                    <p className="text-sm text-slate-600">{session.location}</p>
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
                        const busy = busyKey === key;

                        return (
                          <li
                            key={kid.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-800">
                              {kid.student_name}
                            </span>

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
                            {mark?.status === 'excused' && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                已請假
                                {mark.leave_reason && `：${mark.leave_reason}`}
                              </span>
                            )}

                            {/* 課開始後不給改：資料庫也擋著，這裡先收起來，
                                免得按了才被拒絕 */}
                            {!past && (
                              <span className="ml-auto flex items-center gap-2">
                                {busy && <Spinner className="h-4 w-4 text-slate-500" />}
                                {mark?.status === 'excused' ? (
                                  <button
                                    type="button"
                                    onClick={() => undoLeave(session.id, kid.id)}
                                    disabled={busy}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    取消請假
                                  </button>
                                ) : (
                                  !mark && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLeaveFor(key);
                                        setReason('');
                                        setError('');
                                      }}
                                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                                    >
                                      請假
                                    </button>
                                  )
                                )}
                              </span>
                            )}

                            {leaveFor === key && (
                              <div className="mt-2 w-full">
                                <label
                                  htmlFor={`reason-${key}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  請假原因
                                  <span className="ml-2 font-normal text-slate-500">
                                    選填
                                  </span>
                                </label>
                                <input
                                  id={`reason-${key}`}
                                  type="text"
                                  value={reason}
                                  onChange={reasonIme.onChange}
                                  onCompositionStart={reasonIme.onCompositionStart}
                                  onCompositionEnd={reasonIme.onCompositionEnd}
                                  placeholder="例如：學校活動"
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-brand-500"
                                />
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => submitLeave(session.id, kid.id)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                                  >
                                    {busy && <Spinner />}
                                    送出請假
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLeaveFor(null)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
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
