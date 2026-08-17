import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import {
  cancelMyEntry,
  enterContest,
  getTakenCounts,
  listMyEntries,
  listOpenContests,
} from '../lib/contests';
import { listMyStudents } from '../lib/students';
import {
  formatGrade,
  gradeRank,
  type Contest,
  type ContestEntry,
  type StudentWithSchool,
} from '../lib/types';

export default function ContestsPage() {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [taken, setTaken] = useState<Map<string, number>>(new Map());
  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 一次只會展開一場比賽的孩子選單
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [message, setMessage] = useState<{ contestId: string; text: string } | null>(
    null
  );

  useEffect(() => {
    let active = true;
    async function load() {
      const rows = await listOpenContests();
      const counts = await getTakenCounts(rows.map((item) => item.id));
      if (!active) return;
      setContests(rows);
      setTaken(counts);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([listMyStudents(), listMyEntries()]).then(([kids, mine]) => {
      if (!active) return;
      setStudents(kids);
      setEntries(mine);
    });
    return () => {
      active = false;
    };
  }, [user]);

  async function refreshAfterChange(contestId: string) {
    const [mine, counts] = await Promise.all([
      listMyEntries(),
      getTakenCounts([contestId]),
    ]);
    setEntries(mine);
    setTaken((current) => {
      const next = new Map(current);
      next.set(contestId, counts.get(contestId) ?? 0);
      return next;
    });
  }

  async function handleEnter(contestId: string, studentId: string) {
    const { error } = await enterContest(contestId, studentId);
    if (error) {
      setMessage({ contestId, text: error });
      return;
    }
    setMessage(null);
    setPickerFor(null);
    await refreshAfterChange(contestId);
  }

  async function handleCancel(entry: ContestEntry) {
    const { error } = await cancelMyEntry(entry.id);
    if (error) {
      setMessage({ contestId: entry.contest_id, text: error });
    } else {
      setMessage(null);
    }
    await refreshAfterChange(entry.contest_id);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <div className="p-8 text-center text-slate-500">載入中…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">比賽報名</h1>

        {contests.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            目前沒有開放報名的比賽
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {contests.map((contest) => {
              const count = taken.get(contest.id) ?? 0;
              const full =
                contest.capacity !== null && count >= contest.capacity;
              const myEntry = entries.find(
                (entry) => entry.contest_id === contest.id
              );
              const open = contest.status === 'published' && !full && !myEntry;

              return (
                <li
                  key={contest.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {contest.title}
                    </h2>
                    {contest.status === 'closed' ? (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                        已關閉
                      </span>
                    ) : full ? (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                        已額滿
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        報名中
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-slate-400">比賽日期</dt>
                      <dd>{contest.event_date}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">地點</dt>
                      <dd>{contest.location}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">報名截止</dt>
                      <dd>{contest.signup_deadline}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">參賽年級</dt>
                      <dd>
                        {formatGrade(contest.min_grade)}至
                        {formatGrade(contest.max_grade)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">名額</dt>
                      <dd>
                        {contest.capacity === null
                          ? `已報名 ${count} 人（不限名額）`
                          : `已報名 ${count} / ${contest.capacity} 人`}
                      </dd>
                    </div>
                  </dl>

                  {contest.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                      {contest.description}
                    </p>
                  )}

                  {message?.contestId === contest.id && (
                    <p
                      role="alert"
                      className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {message.text}
                    </p>
                  )}

                  {/* 已經報名了：顯示是誰報的、什麼狀態 */}
                  {myEntry && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-600">
                        已為 {myEntry.student_name}（
                        {formatGrade(myEntry.grade)}）報名
                      </span>
                      <StatusBadge status={myEntry.status} />
                      {myEntry.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(myEntry)}
                          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
                        >
                          取消報名
                        </button>
                      )}
                    </div>
                  )}

                  {open && !user && (
                    <Link
                      to="/login"
                      className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      登入後報名
                    </Link>
                  )}

                  {open && user && pickerFor !== contest.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerFor(contest.id);
                        setMessage(null);
                      }}
                      className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      我要報名
                    </button>
                  )}

                  {open && user && pickerFor === contest.id && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-700">
                        要幫哪一位孩子報名？
                      </p>

                      {students.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          您還沒有建立孩子的資料，
                          <Link to="/my" className="text-brand-600 underline">
                            先去建立
                          </Link>
                          。
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {students.map((student) => {
                            /*
                              前端先擋一次不符年級的孩子，讓家長不必送出才知道。
                              真正的把關在資料庫的 enter_contest()，這裡擋不住的
                              情況（例如剛好改了比賽年級）那邊仍會拒絕。
                            */
                            const rank = gradeRank(student.grade);
                            const min = gradeRank(contest.min_grade);
                            const max = gradeRank(contest.max_grade);
                            const eligible =
                              rank !== null &&
                              min !== null &&
                              max !== null &&
                              rank >= min &&
                              rank <= max;

                            return (
                              <li
                                key={student.id}
                                className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2"
                              >
                                <span className="font-medium text-slate-800">
                                  {student.name}
                                </span>
                                <span className="text-sm text-slate-500">
                                  {formatGrade(student.grade)}
                                </span>
                                {eligible ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEnter(contest.id, student.id)
                                    }
                                    className="ml-auto rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                                  >
                                    報名
                                  </button>
                                ) : (
                                  <span className="ml-auto text-sm text-slate-400">
                                    年級不符
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <button
                        type="button"
                        onClick={() => setPickerFor(null)}
                        className="mt-3 text-sm text-slate-500 underline"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
