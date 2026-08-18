import { useEffect, useState } from 'react';
import { CalendarPlus, Check, Trash2, X } from 'lucide-react';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import Spinner, { PageLoading } from '../components/Spinner';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import { listAllContests, listContestEntries } from '../lib/contests';
import {
  clearAttendance,
  createSession,
  deleteSession,
  listAttendance,
  listSessions,
  markAttendance,
  updateSession,
  type NewTrainingSession,
} from '../lib/training';
import {
  formatGrade,
  formatTime,
  type Contest,
  type ContestEntry,
  type TrainingAttendance,
  type TrainingSession,
} from '../lib/types';

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

type SessionForm = Omit<NewTrainingSession, 'contest_id'>;

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);

  // 展開哪一場的點名畫面
  const [rollCallFor, setRollCallFor] = useState<string | null>(null);

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
    listSessions(contestId).then((rows) => {
      if (!active) return;
      setSessions(rows);
      setLoadingSessions(false);
    });
    return () => {
      active = false;
    };
  }, [contestId]);

  async function reloadSessions() {
    setSessions(await listSessions(contestId));
  }

  const noteIme = useImeGuardedInput<HTMLTextAreaElement>((note) => patch({ note }));

  function patch(next: Partial<SessionForm>) {
    setForm((current) => (current ? { ...current, ...next } : current));
  }

  function startCreate() {
    setEditingId(null);
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

  if (loading) return <PageLoading label="正在讀取比賽…" />;

  return (
    <>
      <AdminPageHeader
        title="集訓管理"
        description="集訓場次掛在比賽底下。已錄取的孩子會在自己的頁面看到時間表，也能事先請假。"
        maxWidth="max-w-5xl"
        action={
          contestId !== '' &&
          form === null && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              排一場
            </button>
          )
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6">

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
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

      {form && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? '修改場次' : '排一場集訓'}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        <ul className="mt-6 space-y-4">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words">
                  <h2 className="font-semibold text-slate-900">
                    {session.session_date}　{formatTime(session.start_time)}–
                    {formatTime(session.end_time)}
                  </h2>
                  {session.location && (
                    <p className="mt-1 text-sm text-slate-600">{session.location}</p>
                  )}
                  {session.note && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                      {session.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setRollCallFor(rollCallFor === session.id ? null : session.id)
                  }
                  className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
                >
                  {rollCallFor === session.id ? '收起點名' : '點名'}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(session)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  修改
                </button>
                {confirmingDeleteId === session.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(session.id)}
                      disabled={busySessionId === session.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {busySessionId === session.id && <Spinner />}
                      確定刪除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      取消
                    </button>
                    <span className="text-sm text-red-700">
                      這場的點名紀錄會一併刪除
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(session.id)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    刪除
                  </button>
                )}
              </div>

              {rollCallFor === session.id && (
                <RollCall session={session} onError={setError} />
              )}
            </li>
          ))}
        </ul>
      )}
      </div>
    </>
  );
}

/*
  點名。名單取自這場比賽「已錄取」的報名 —— 待審核與已聯絡的還沒確定
  要不要來，混進點名表只會讓人每次都要重新判斷誰該在場。
*/
function RollCall({
  session,
  onError,
}: {
  session: TrainingSession;
  onError: (message: string) => void;
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
      <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <Spinner />
        正在讀取名單…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
        這場比賽還沒有已錄取的孩子。要先在比賽管理把報名狀態改成「已錄取」，
        名單才會出現在這裡。
      </p>
    );
  }

  const present = entries.filter((e) => marks.get(e.id)?.status === 'present').length;
  const excused = entries.filter((e) => marks.get(e.id)?.status === 'excused').length;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-600">
        共 {entries.length} 人，已到 {present} 人
        {excused > 0 && `，請假 ${excused} 人`}
      </p>

      <ul className="mt-3 space-y-2">
        {entries.map((entry) => {
          const mark_ = marks.get(entry.id);
          const busy = busyEntryId === entry.id;

          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
            >
              <span className="font-medium text-slate-800">{entry.student_name}</span>
              <span className="text-sm text-slate-600">{formatGrade(entry.grade)}</span>

              {/* 請假是家長事先按的，點名時要一眼看到，不必翻紀錄 */}
              {mark_?.status === 'excused' && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  已請假
                  {mark_.leave_reason && `：${mark_.leave_reason}`}
                </span>
              )}

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
                    aria-label={`清除 ${entry.student_name} 的點名`}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
