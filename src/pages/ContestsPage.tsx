import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import Spinner, { PageLoading } from '../components/Spinner';
import {
  DashedRule,
  SearchingDoodle,
  Spark,
  Squiggle,
  TrophyDoodle,
} from '../components/doodles';
import {
  cancelMyEntry,
  enterContest,
  getContest,
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
  // 帶了代碼就是從分享連結進來的，只顯示那一場
  const { contestId } = useParams();
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
  // 哪一場比賽正在等報名或取消的回應
  const [busyContestId, setBusyContestId] = useState<string | null>(null);

  const shown = contestId
    ? contests.filter((item) => item.id === contestId)
    : contests;

  useEffect(() => {
    let active = true;
    async function load() {
      /*
        帶了代碼就直接讀那一場、不篩狀態 —— 管理員藉此預覽還沒發佈的
        草稿（列級權限只讓管理員讀得到草稿，家長會拿到 null 而看到
        「找不到這場比賽」，跟發佈前的實際情況一致）。
      */
      const rows = contestId
        ? [await getContest(contestId)].filter((item) => item !== null)
        : await listOpenContests();
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
  }, [contestId]);

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

  async function handleEnter(id: string, studentId: string) {
    setBusyContestId(id);
    const { error } = await enterContest(id, studentId);
    if (error) {
      setBusyContestId(null);
      setMessage({ contestId: id, text: error });
      return;
    }
    setMessage(null);
    setPickerFor(null);
    await refreshAfterChange(id);
    setBusyContestId(null);
  }

  async function handleCancel(entry: ContestEntry) {
    setBusyContestId(entry.contest_id);
    const { error } = await cancelMyEntry(entry.id);
    if (error) {
      setMessage({ contestId: entry.contest_id, text: error });
    } else {
      setMessage(null);
    }
    await refreshAfterChange(entry.contest_id);
    setBusyContestId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader />
        <PageLoading label="正在讀取比賽…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="flex items-start gap-3">
          <TrophyDoodle className="mt-1 h-14 w-14 shrink-0 -rotate-6 text-brand-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">比賽報名</h1>
            <div className="mt-1 w-24">
              <Squiggle className="text-amber-400" />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              帶著孩子把平常練的成果拿出來比一場，報名後我們會再與您確認細節。
            </p>
          </div>
        </div>

        {contestId && (
          <Link
            to="/contests"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 underline decoration-amber-400 decoration-2 underline-offset-4"
          >
            <Spark className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            看全部比賽
          </Link>
        )}

        {/* 草稿只有管理員讀得到，會走到這裡的就是在預覽 */}
        {shown.some((item) => item.status === 'draft') && (
          <p className="mt-4 rounded-[1.2rem_0.9rem_1.25rem_0.95rem] border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            預覽中：這場比賽還是草稿，家長打開這個連結會看到「找不到這場比賽」。
            要開放報名請回後台按發佈。
          </p>
        )}

        {shown.length === 0 ? (
          <div className="doodle-card mt-6 px-6 py-10 text-center">
            <SearchingDoodle className="mx-auto h-24 w-auto text-slate-400" />
            <p className="mt-4 text-base font-semibold text-slate-700">
              {/* 分享連結指到草稿或已刪除的比賽時，家長會落到這裡 */}
              {contestId
                ? '找不到這場比賽，可能尚未開放或已經結束'
                : '目前沒有開放報名的比賽'}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              新的場次開放時會放在這裡，也歡迎直接聯絡中心詢問。
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-5">
            {shown.map((contest, index) => {
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
                  // 圓角左右交錯，一整排卡片才不會整齊得像表格
                  className={`${
                    index % 2 === 0 ? 'doodle-card' : 'doodle-card-alt'
                  } p-5 sm:p-6`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words text-lg font-bold text-slate-900">
                      {contest.title}
                    </h2>
                    {contest.status === 'draft' ? (
                      <span className="shrink-0 rounded-full border-2 border-amber-300 bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-900">
                        草稿
                      </span>
                    ) : contest.status === 'closed' ? (
                      <span className="shrink-0 rounded-full border-2 border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
                        已關閉
                      </span>
                    ) : full ? (
                      <span className="shrink-0 rounded-full border-2 border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
                        已額滿
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border-2 border-emerald-300 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
                        報名中
                      </span>
                    )}
                  </div>

                  <div className="mt-3 text-slate-300">
                    <DashedRule />
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <Row label="比賽日期" value={contest.event_date} />
                    <Row label="地點" value={contest.location} />
                    <Row label="報名截止" value={contest.signup_deadline} />
                    <Row
                      label="參賽年級"
                      value={`${formatGrade(contest.min_grade)}至${formatGrade(
                        contest.max_grade
                      )}`}
                    />
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-medium text-slate-500">名額</dt>
                      <dd className="min-w-0 break-words font-semibold text-slate-800">
                        {contest.capacity === null
                          ? `已報名 ${count} 人（不限名額）`
                          : `已報名 ${count} / ${contest.capacity} 人`}
                      </dd>
                    </div>
                  </dl>

                  {contest.description && (
                    <p className="mt-4 whitespace-pre-wrap break-words rounded-[1rem_0.8rem_1.05rem_0.85rem] bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {contest.description}
                    </p>
                  )}

                  {message?.contestId === contest.id && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
                    >
                      {message.text}
                    </p>
                  )}

                  {/* 已經報名了：顯示是誰報的、什麼狀態 */}
                  {myEntry && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1rem_0.8rem_1.05rem_0.85rem] border-2 border-brand-100 bg-brand-50 px-3 py-2.5 text-sm">
                      <span className="min-w-0 break-words font-medium text-slate-700">
                        已為 {myEntry.student_name}（
                        {formatGrade(myEntry.grade)}）報名
                      </span>
                      <StatusBadge status={myEntry.status} />
                      {myEntry.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancel(myEntry)}
                          disabled={busyContestId === contest.id}
                          className="doodle-btn-quiet ml-auto inline-flex items-center gap-2 px-3 py-1.5 text-sm disabled:opacity-60"
                        >
                          {busyContestId === contest.id && <Spinner />}
                          取消報名
                        </button>
                      )}
                    </div>
                  )}

                  {open && !user && (
                    <Link
                      to="/login"
                      className="doodle-btn mt-5 inline-block px-5 py-2.5 text-sm"
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
                      className="doodle-btn mt-5 px-5 py-2.5 text-sm"
                    >
                      我要報名
                    </button>
                  )}

                  {open && user && pickerFor === contest.id && (
                    <div className="mt-5 rounded-[1.2rem_0.95rem_1.25rem_1rem] border-2 border-dashed border-brand-200 bg-brand-50/60 p-4">
                      <p className="text-sm font-bold text-slate-800">
                        要幫哪一位孩子報名？
                      </p>

                      {students.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">
                          您還沒有建立孩子的資料，
                          <Link
                            to="/my"
                            className="font-semibold text-brand-700 underline decoration-amber-400 decoration-2 underline-offset-4"
                          >
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
                                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.9rem_0.7rem_0.95rem_0.75rem] border-2 border-slate-900/10 bg-white px-3 py-2"
                              >
                                <span className="min-w-0 break-words font-semibold text-slate-800">
                                  {student.name}
                                </span>
                                <span className="text-sm text-slate-600">
                                  {formatGrade(student.grade)}
                                </span>
                                {eligible ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEnter(contest.id, student.id)
                                    }
                                    disabled={busyContestId === contest.id}
                                    className="doodle-btn ml-auto inline-flex items-center gap-2 px-4 py-1.5 text-sm"
                                  >
                                    {busyContestId === contest.id && <Spinner />}
                                    報名
                                  </button>
                                ) : (
                                  // slate-400 在白底只有 2.8:1，家長看不清楚為什麼不能報
                                  <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
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
                        className="mt-3 text-sm font-medium text-slate-600 underline underline-offset-4"
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

/** 比賽資訊一行。標籤固定寬度，右邊的值才對得齊 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-700">{value}</dd>
    </div>
  );
}
