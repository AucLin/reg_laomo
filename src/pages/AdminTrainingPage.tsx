import { useEffect, useState } from 'react';
import {
  CalendarPlus,
  CalendarRange,
  Check,
  Copy,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import Spinner, { PageLoading } from '../components/Spinner';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import { listAllContests, listContestEntries } from '../lib/contests';
import {
  clearAttendance,
  createSession,
  createSessions,
  deleteSession,
  listAttendance,
  listAttendanceForSessions,
  listSessions,
  markAttendance,
  updateSession,
  type NewTrainingSession,
} from '../lib/training';
import { planSeries, type SeriesForm } from '../lib/recurrence';
import { summariseHeadcount } from '../lib/trainingHeadcount';
import { buildCalendar, type CalendarDay, type CalendarMonth } from '../lib/trainingCalendar';
import {
  buildTrainingNoticeText,
  copyToClipboard,
  myRegistrationsUrl,
} from '../lib/share';
import {
  formatGrade,
  formatShortDate,
  formatTime,
  isSessionPast,
  type Contest,
  type ContestEntry,
  type TrainingAttendance,
  type TrainingSession,
} from '../lib/types';

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

type SessionForm = Omit<NewTrainingSession, 'contest_id'>;

/** 排整期的表單：日期是一個區間加上每週哪幾天，時間整期共用 */
type SeriesFormState = SeriesForm & { note: string };

/*
  名單每一列的底色。點名結果用顏色講，老莫掃一眼就知道哪幾個還沒點到，
  不必逐列讀按鈕的按下狀態。
*/
const ROW_TONE: Record<TrainingAttendance['status'], string> = {
  signed_up: 'bg-brand-50 ring-brand-100',
  present: 'bg-emerald-50 ring-emerald-200',
  absent: 'bg-red-50 ring-red-200',
};

const EMPTY_FORM: SessionForm = {
  session_date: '',
  start_time: '',
  end_time: '',
  note: '',
};

export default function AdminTrainingPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestId, setContestId] = useState('');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<SessionForm | null>(null);
  /*
    排整期的表單。跟單場表單互斥 —— 同時開兩個只會讓人不確定按下儲存
    會發生什麼事，所以開其中一個就把另一個關掉。
  */
  const [series, setSeries] = useState<SeriesFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  // 複製的提示要自己收掉：它講的是剛才那個動作，不是畫面的狀態
  const [copyNote, setCopyNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);

  // 展開哪一場的點名畫面
  const [rollCallFor, setRollCallFor] = useState<string | null>(null);

  /*
    這場比賽所有場次的挑選紀錄，以及已錄取的孩子。

    人數是老莫排完時段最想知道的事，但單看「3 人」判斷不了多寡 ——
    要有分母（錄取幾個）跟旁邊幾場可以比。所以這裡留的是整份紀錄，
    不是每場一個數字。
  */
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [enrolled, setEnrolled] = useState<ContestEntry[]>([]);

  useEffect(() => {
    listAllContests()
      .then((rows) => {
        setContests(rows);
        // 只有一場比賽時直接選起來，少一個沒有意義的動作
        if (rows.length === 1) setContestId(rows[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (contestId === '') {
      setSessions([]);
      return;
    }
    let active = true;
    setLoadingSessions(true);
    listSessions(contestId).then(async (rows) => {
      if (!active) return;
      setSessions(rows);
      const [marks, entries] = await Promise.all([
        listAttendanceForSessions(rows.map((row) => row.id)),
        listContestEntries(contestId),
      ]);
      if (!active) return;
      setAttendance(marks);
      // 集訓是錄取之後的事，待審核的孩子不算進分母
      setEnrolled(entries.filter((entry) => entry.status === 'enrolled'));
      setLoadingSessions(false);
    });
    return () => {
      active = false;
    };
  }, [contestId]);

  async function reloadSessions() {
    const rows = await listSessions(contestId);
    setSessions(rows);
    setAttendance(await listAttendanceForSessions(rows.map((row) => row.id)));
  }

  async function reloadCounts() {
    setAttendance(await listAttendanceForSessions(sessions.map((row) => row.id)));
  }

  const noteIme = useImeGuardedInput<HTMLTextAreaElement>((note) => {
    patch({ note });
    setSeries((current) => (current ? { ...current, note } : current));
  });

  function patch(next: Partial<SessionForm>) {
    setForm((current) => (current ? { ...current, ...next } : current));
  }

  /** 沿用最後一場的時間：集訓通常整期同一個時段，只有日期在變 */
  function lastTimes(): { start_time: string; end_time: string } {
    const last = sessions[sessions.length - 1];
    return last
      ? { start_time: last.start_time.slice(0, 5), end_time: last.end_time.slice(0, 5) }
      : { start_time: '', end_time: '' };
  }

  function startSeries() {
    setForm(null);
    setEditingId(null);
    setFormError('');
    setNotice('');
    setSeries({ from: '', to: '', weekdays: [], note: '', ...lastTimes() });
  }

  function patchSeries(next: Partial<SeriesFormState>) {
    setSeries((current) => (current ? { ...current, ...next } : current));
  }

  function toggleWeekday(day: number) {
    setSeries((current) =>
      current
        ? {
            ...current,
            weekdays: current.weekdays.includes(day)
              ? current.weekdays.filter((d) => d !== day)
              : [...current.weekdays, day].sort(),
          }
        : current
    );
  }

  function startCreate() {
    setSeries(null);
    setEditingId(null);
    setNotice('');
    /*
      新增第二場以後沿用上一場的時間：集訓通常是同一個時段，只有日期
      在變。全部留空等於每次都要重打一遍。
    */
    const last = sessions[sessions.length - 1];
    setForm(
      last
        ? {
            session_date: '',
            start_time: last.start_time.slice(0, 5),
            end_time: last.end_time.slice(0, 5),
            note: '',
          }
        : EMPTY_FORM
    );
    setFormError('');
  }

  function startEdit(session: TrainingSession) {
    setSeries(null);
    setNotice('');
    setEditingId(session.id);
    setForm({
      session_date: session.session_date,
      start_time: session.start_time.slice(0, 5),
      end_time: session.end_time.slice(0, 5),
      note: session.note ?? '',
    });
    setFormError('');
  }

  function closeForm() {
    setForm(null);
    setSeries(null);
    setEditingId(null);
    setFormError('');
  }

  // 資料庫有 training_sessions_time_order 擋著，這裡先擋一次只是為了
  // 給看得懂的訊息
  function validate(value: SessionForm): string | null {
    if (value.session_date === '') return '請選擇日期';
    if (value.start_time === '') return '請填寫開始時間';
    if (value.end_time === '') return '請填寫結束時間';
    if (value.end_time <= value.start_time) return '結束時間要晚於開始時間';
    return null;
  }

  async function handleSave() {
    if (!form) return;
    const problem = validate(form);
    if (problem) {
      setFormError(problem);
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      note: form.note?.trim() === '' ? null : form.note,
    };
    const { error: saveError } = editingId
      ? await updateSession(editingId, payload)
      : await createSession({ ...payload, contest_id: contestId });
    setSaving(false);

    if (saveError) {
      setFormError(saveError);
      return;
    }
    closeForm();
    await reloadSessions();
  }

  async function handleSaveSeries() {
    if (!series) return;
    const plan = planSeries(series, sessions);
    if (plan.error) {
      setFormError(plan.error);
      return;
    }

    setSaving(true);
    const note = series.note.trim() === '' ? null : series.note;
    const { created, error: saveError } = await createSessions(
      plan.dates.map((session_date) => ({
        contest_id: contestId,
        session_date,
        start_time: series.start_time,
        end_time: series.end_time,
        note,
      }))
    );
    setSaving(false);

    if (saveError) {
      setFormError(saveError);
      return;
    }
    closeForm();
    setNotice(
      plan.skipped.length > 0
        ? `排好 ${created} 場，另外 ${plan.skipped.length} 場之前已經排過了`
        : `排好 ${created} 場`
    );
    await reloadSessions();
  }

  async function handleDelete(id: string) {
    setBusySessionId(id);
    const { error: deleteError } = await deleteSession(id);
    setConfirmingDeleteId(null);
    if (deleteError) {
      setBusySessionId(null);
      setError(deleteError);
      return;
    }
    if (rollCallFor === id) setRollCallFor(null);
    await reloadSessions();
    setBusySessionId(null);
  }

  async function handleCopyNotice(text: string) {
    const ok = await copyToClipboard(text);
    // 複製失敗要說出來。靜靜地什麼都沒發生，老莫會以為複製好了
    setCopyNote(
      ok ? '通知文案已複製，貼到 LINE 群組就行' : '複製失敗，請手動選取後複製'
    );
    window.setTimeout(() => setCopyNote(''), 4000);
  }

  if (loading) return <PageLoading label="正在讀取比賽…" />;

  // 邊填邊算，讓老莫在按下去之前就看到會排出哪幾天
  const plan = series ? planSeries(series, sessions) : null;

  // 通知文案只列還沒上的場次
  const upcoming = sessions.filter((session) => !isSessionPast(session));
  /*
    貼到 LINE 群組的通知。系統不會主動寄信 —— 家長本來就都在群組裡，
    貼一則的到達率比信箱高得多，所以「發給家長」就是把這段文字複製走。
    只列還沒上的場次：已經上完的寫進通知，家長會以為自己漏掉了什麼。
  */
  const noticeText = (() => {
    const contest = contests.find((item) => item.id === contestId);
    if (!contest) return '';
    return buildTrainingNoticeText(contest, upcoming, myRegistrationsUrl());
  })();
  /* 每一場幾個人要來、哪幾場人少到該改時間 */
  const headcount = summariseHeadcount(sessions, enrolled, attendance);
  const months = buildCalendar(sessions);
  const selected = sessions.find((session) => session.id === rollCallFor) ?? null;

  // 今天要標出來。用本地時間組字串 —— toISOString() 給的是 UTC 日期，
  // 台灣早上八點前會標到前一天
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  /*
    月曆。

    列表看得出「哪一場人少」，看不出「這一週都沒排」「連著三天都排」
    —— 那正是要調時間時的依據：把人少的那天挪到旁邊有課的日子，一次
    就補滿。點某一天的場次，詳情就展開在那個月底下。
  */
  function renderSessionChip(session: TrainingSession) {
    const past = isSessionPast(session);
    const low = headcount.lowSessionIds.has(session.id);
    const open = rollCallFor === session.id;
    const count = headcount.counts.get(session.id) ?? 0;

    const tone = past
      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      : low
        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
        : 'bg-brand-100 text-brand-800 hover:bg-brand-200';

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => setRollCallFor(open ? null : session.id)}
        aria-expanded={open}
        className={`block w-full rounded-md px-1 py-1 text-left text-[11px] leading-tight transition sm:px-1.5 sm:py-0.5 ${tone} ${
          open ? 'ring-2 ring-brand-500' : ''
        }`}
      >
        <span className="sr-only">
          {formatTime(session.start_time)} 開始，{count} 人要來，共 {headcount.enrolled}{' '}
          位錄取
          {low && !past && '，人偏少'}
        </span>
        {/* 手機的格子放不下時間，人數才是要看的 */}
        <span className="hidden tabular-nums sm:inline" aria-hidden="true">
          {formatTime(session.start_time)}{' '}
        </span>
        <span className="font-semibold tabular-nums" aria-hidden="true">
          {count}/{headcount.enrolled}
        </span>
      </button>
    );
  }

  function renderDay(day: CalendarDay, key: number) {
    // 月初月末補的空格
    if (day.date === null) return <div key={key} className="min-h-[72px] bg-slate-50/60" />;

    const dayNumber = Number(day.date.slice(8));
    const isToday = day.date === todayISO;

    return (
      <div key={day.date} className="min-h-[72px] space-y-0.5 bg-white p-1">
        <div
          className={`px-0.5 text-[11px] ${
            isToday ? 'font-bold text-brand-700' : 'text-slate-400'
          }`}
        >
          {dayNumber}
        </div>
        {day.sessions.map(renderSessionChip)}
      </div>
    );
  }

  function renderMonth(month: CalendarMonth) {
    const prefix = `${month.year}-${String(month.month).padStart(2, '0')}`;
    // 詳情展開在它自己那個月底下，不然選了第一個月的場次要捲到最後才看得到
    const showDetail = selected !== null && selected.session_date.startsWith(prefix);

    return (
      <section key={prefix}>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          {month.year} 年 {month.month} 月
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-medium text-slate-500">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1.5">
                {label}
              </div>
            ))}
          </div>
          {/* gap-px 加上格子的白底，格線就是底色透出來的 */}
          <div className="grid grid-cols-7 gap-px bg-slate-100">
            {month.weeks.flat().map(renderDay)}
          </div>
        </div>
        {showDetail && selected !== null && renderSelected(selected)}
      </section>
    );
  }

  /* 選中那一場的詳情：改時間、刪除，以及誰會來 */
  function renderSelected(session: TrainingSession) {
    const past = isSessionPast(session);
    const low = headcount.lowSessionIds.has(session.id);
    const count = headcount.counts.get(session.id) ?? 0;
    const confirming = confirmingDeleteId === session.id;
    const shortDate = formatShortDate(session.session_date);

    return (
      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3">
          <span className={`font-semibold ${past ? 'text-slate-500' : 'text-slate-900'}`}>
            {shortDate}
          </span>
          <span className="tabular-nums text-sm text-slate-600">
            {formatTime(session.start_time)}–{formatTime(session.end_time)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              past
                ? 'bg-slate-100 text-slate-600'
                : low
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-brand-100 text-brand-800'
            }`}
          >
            {count}/{headcount.enrolled} 人
          </span>
          {low && !past && (
            <span className="text-xs text-amber-800">
              人偏少，可以改到旁邊有課的日子把人併過來
            </span>
          )}

          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => startEdit(session)}
              aria-label={`修改 ${shortDate} 這場`}
              title="修改"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDeleteId(confirming ? null : session.id)}
              aria-label={`刪除 ${shortDate} 這場`}
              title="刪除"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setRollCallFor(null)}
              aria-label="收起這場"
              title="收起"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </div>

        {confirming && (
          <div className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-3 text-sm">
            <span className="text-red-800">刪掉這場？這場的點名紀錄會一併刪除。</span>
            <button
              type="button"
              onClick={() => handleDelete(session.id)}
              disabled={busySessionId === session.id}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busySessionId === session.id && <Spinner />}
              確定刪除
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDeleteId(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        )}

        {(session.location || session.note) && (
          <div className="px-4 pt-3 text-sm">
            {session.location && <p className="text-slate-600">{session.location}</p>}
            {session.note && (
              <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-100">
                {session.note}
              </p>
            )}
          </div>
        )}

        <RollCall session={session} onError={setError} onChanged={reloadCounts} />
      </div>
    );
  }


  return (
    <>
      <AdminPageHeader
        title="集訓管理"
        description="集訓場次掛在比賽底下。排好的時段會出現在家長的頁面，家長挑哪幾場，孩子就會出現在那幾場的名單上。"
        maxWidth="max-w-5xl"
        action={
          contestId !== '' &&
          form === null &&
          series === null && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startSeries}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
                排整期
              </button>
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                只排一場
              </button>
            </div>
          )
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6">

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <label htmlFor="training_contest" className="block text-sm font-medium text-slate-700">
          哪一場比賽
        </label>
        <select
          id="training_contest"
          value={contestId}
          onChange={(event) => {
            setContestId(event.target.value);
            closeForm();
            setRollCallFor(null);
          }}
          className={INPUT_CLASS}
        >
          <option value="">請選擇</option>
          {contests.map((contest) => (
            <option key={contest.id} value={contest.id}>
              {contest.title}（{contest.event_date}）
            </option>
          ))}
        </select>
      </div>

      {series && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">排整期集訓</h2>
          <p className="mt-1 text-sm text-slate-600">
            挑出這一期的起訖日期與每週上課的星期，一次把所有場次排好。
            其中某一場要改時間或加備註，排好之後再單獨改那一場。
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="series_from" className="block text-sm font-medium text-slate-700">
                從
              </label>
              <input
                id="series_from"
                type="date"
                value={series.from}
                onChange={(event) => patchSeries({ from: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="series_to" className="block text-sm font-medium text-slate-700">
                到
              </label>
              <input
                id="series_to"
                type="date"
                value={series.to}
                onChange={(event) => patchSeries({ to: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">每週哪幾天</legend>
            <div className="mt-2 flex gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const on = series.weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    aria-pressed={on}
                    aria-label={`星期${label}`}
                    className={`h-11 flex-1 rounded-full text-sm font-medium transition sm:w-11 sm:flex-none ${
                      on
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="series_start" className="block text-sm font-medium text-slate-700">
                開始時間
              </label>
              <input
                id="series_start"
                type="time"
                value={series.start_time}
                onChange={(event) => patchSeries({ start_time: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="series_end" className="block text-sm font-medium text-slate-700">
                結束時間
              </label>
              <input
                id="series_end"
                type="time"
                value={series.end_time}
                onChange={(event) => patchSeries({ end_time: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="series_note" className="block text-sm font-medium text-slate-700">
              備註
              <span className="ml-2 text-xs font-normal text-slate-500">
                選填，家長看得到，每一場都會帶上
              </span>
            </label>
            <textarea
              id="series_note"
              rows={2}
              value={series.note}
              onChange={noteIme.onChange}
              onCompositionStart={noteIme.onCompositionStart}
              onCompositionEnd={noteIme.onCompositionEnd}
              placeholder="這期要帶的東西、進度…"
              className={INPUT_CLASS}
            />
          </div>

          {plan && plan.error === null && (
            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm ring-1 ring-brand-100">
              <p className="font-semibold text-brand-900">會排 {plan.dates.length} 場</p>
              <p className="mt-1 break-words text-brand-800">
                {plan.dates.map(formatShortDate).join('、')}
              </p>
              {plan.skipped.length > 0 && (
                <p className="mt-1 text-xs text-brand-700">
                  另外 {plan.skipped.length} 場之前已經排過了，這次會跳過
                </p>
              )}
            </div>
          )}

          {formError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleSaveSeries}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Spinner />}
              {saving ? '排課中…' : '排課'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {form && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? '修改場次' : '排一場集訓'}
          </h2>

          {/* 拿掉上課地點後剩三個欄位，兩欄格線會讓結束時間自己孤零零
              佔一整列。三欄剛好一列排完，日期、開始、結束也本來就該
              在同一行讀 */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="session_date" className="block text-sm font-medium text-slate-700">
                日期
              </label>
              <input
                id="session_date"
                type="date"
                value={form.session_date}
                onChange={(event) => patch({ session_date: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="session_start" className="block text-sm font-medium text-slate-700">
                開始時間
              </label>
              <input
                id="session_start"
                type="time"
                value={form.start_time}
                onChange={(event) => patch({ start_time: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="session_end" className="block text-sm font-medium text-slate-700">
                結束時間
              </label>
              <input
                id="session_end"
                type="time"
                value={form.end_time}
                onChange={(event) => patch({ end_time: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="session_note" className="block text-sm font-medium text-slate-700">
                備註
                <span className="ml-2 text-xs font-normal text-slate-500">
                  選填，家長看得到
                </span>
              </label>
              <textarea
                id="session_note"
                rows={2}
                value={form.note ?? ''}
                onChange={noteIme.onChange}
                onCompositionStart={noteIme.onCompositionStart}
                onCompositionEnd={noteIme.onCompositionEnd}
                placeholder="這次要帶的東西、進度…"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Spinner />}
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </section>
      )}

      {contestId === '' ? (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">
          先選一場比賽，才能排它的集訓
        </p>
      ) : loadingSessions ? (
        <PageLoading label="正在讀取場次…" />
      ) : sessions.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">
          這場比賽還沒排集訓
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 格子的顏色在講什麼 */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded bg-brand-100 ring-1 ring-brand-200"
                  aria-hidden="true"
                />
                有人挑了
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-200"
                  aria-hidden="true"
                />
                人偏少
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-300"
                  aria-hidden="true"
                />
                已經上完
              </span>
            </div>

            {noticeText !== '' && (
              <button
                type="button"
                onClick={() => handleCopyNotice(noticeText)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                複製通知文案
              </button>
            )}
          </div>

          {copyNote && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
            >
              {copyNote}
            </p>
          )}

          {months.map(renderMonth)}
        </div>
      )}
      </div>
    </>
  );
}

/*
  這一場的名單。

  分成兩區：家長挑了這個時段的（會來），以及錄取了但沒挑這一場的。
  第二區不是多餘的 —— 老莫要知道的不只「誰會來」，還有「誰整期都沒挑」，
  那通常代表家長忘了挑，該打通電話。

  名單取自這場比賽「已錄取」的報名。待審核與已聯絡的還沒確定要不要來，
  混進來只會讓人每次都要重新判斷誰該在場。
*/
function RollCall({
  session,
  onError,
  onChanged,
}: {
  session: TrainingSession;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [marks, setMarks] = useState<Map<string, TrainingAttendance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listContestEntries(session.contest_id),
      listAttendance(session.id),
    ]).then(([rows, attendance]) => {
      if (!active) return;
      setEntries(rows.filter((row) => row.status === 'enrolled'));
      setMarks(new Map(attendance.map((item) => [item.entry_id, item])));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session.id, session.contest_id]);

  async function refresh() {
    setMarks(new Map((await listAttendance(session.id)).map((i) => [i.entry_id, i])));
    // 場次卡片上的「幾人會來」也要跟著變
    onChanged();
  }

  async function mark(entryId: string, status: 'present' | 'absent') {
    setBusyEntryId(entryId);
    const { error } = await markAttendance(session.id, entryId, status);
    if (error) onError(error);
    else await refresh();
    setBusyEntryId(null);
  }

  async function clear(entryId: string) {
    setBusyEntryId(entryId);
    const { error } = await clearAttendance(session.id, entryId);
    if (error) onError(error);
    else await refresh();
    setBusyEntryId(null);
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600">
        <Spinner />
        正在讀取名單…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-slate-600">
        這場比賽還沒有已錄取的孩子。要先在比賽管理把報名狀態改成「已錄取」，
        名單才會出現在這裡。
      </p>
    );
  }

  // 有列就代表家長挑了這個時段（點過名的那幾列本來也是挑出來的）
  const coming = entries.filter((entry) => marks.has(entry.id));
  const notPicked = entries.filter((entry) => !marks.has(entry.id));
  const present = coming.filter((e) => marks.get(e.id)?.status === 'present').length;

  function renderActions(entry: ContestEntry) {
    const mark_ = marks.get(entry.id);
    const busy = busyEntryId === entry.id;

    return (
      <div className="ml-auto flex items-center gap-2">
        {busy && <Spinner className="h-4 w-4 text-slate-500" />}
        <button
          type="button"
          onClick={() => mark(entry.id, 'present')}
          disabled={busy}
          aria-pressed={mark_?.status === 'present'}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition disabled:opacity-60 ${
            mark_?.status === 'present'
              ? 'bg-emerald-600 font-medium text-white'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          到
        </button>
        <button
          type="button"
          onClick={() => mark(entry.id, 'absent')}
          disabled={busy}
          aria-pressed={mark_?.status === 'absent'}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition disabled:opacity-60 ${
            mark_?.status === 'absent'
              ? 'bg-red-600 font-medium text-white'
              : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          沒到
        </button>
        {mark_ && (
          <button
            type="button"
            onClick={() => clear(entry.id)}
            disabled={busy}
            aria-label={`把 ${entry.student_name} 移出這個時段`}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
          錄取 {entries.length} 人
        </span>
        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700">
          這個時段 {coming.length} 人會來
        </span>
        {present > 0 && (
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
            已到 {present} 人
          </span>
        )}
      </div>

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
          會來（{coming.length}）
        </h3>
        {coming.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">還沒有家長挑這個時段</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {coming.map((entry) => {
              const mark_ = marks.get(entry.id);

              return (
                <li
                  key={entry.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 ring-1 ${ROW_TONE[mark_?.status ?? 'signed_up']}`}
                >
                  <span className="font-medium text-slate-800">{entry.student_name}</span>
                  <span className="text-sm text-slate-600">{formatGrade(entry.grade)}</span>
                  {mark_?.status === 'signed_up' && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                      待點名
                    </span>
                  )}
                  {mark_?.status === 'present' && (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">
                      已到
                    </span>
                  )}
                  {mark_?.status === 'absent' && (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white">
                      沒到
                    </span>
                  )}
                  {renderActions(entry)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notPicked.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span
              className="h-2 w-2 rounded-full ring-1 ring-slate-400"
              aria-hidden="true"
            />
            沒挑這個時段（{notPicked.length}）
          </h3>
          {/* 人到了照樣可以標「到」—— 現場來的孩子不能因為家長忘了挑
              就記不進去 */}
          <ul className="mt-2 space-y-2">
            {notPicked.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-500"
              >
                <span className="font-medium">{entry.student_name}</span>
                <span className="text-sm">{formatGrade(entry.grade)}</span>
                {renderActions(entry)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
