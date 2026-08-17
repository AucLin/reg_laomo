import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import {
  createContest,
  deleteContest,
  getTakenCounts,
  listAllContests,
  listContestEntries,
  updateContest,
  updateEntryStatus,
  type NewContest,
} from '../lib/contests';
import {
  CONTEST_STATUS_LABELS,
  formatGrade,
  getGradeOptions,
  gradeRank,
  STATUS_LABELS,
  type Contest,
  type ContestEntry,
  type ContestStatus,
  type RegistrationStatus,
} from '../lib/types';

const ALL_GRADES = [
  ...getGradeOptions('elementary'),
  ...getGradeOptions('junior'),
  ...getGradeOptions('senior'),
];

const EMPTY_FORM: NewContest = {
  title: '',
  description: '',
  event_date: '',
  location: '',
  signup_deadline: '',
  capacity: null,
  min_grade: 'E1',
  max_grade: 'S3',
  status: 'draft',
};

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const STATUS_STYLES: Record<ContestStatus, string> = {
  draft: 'bg-slate-200 text-slate-600',
  published: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-amber-100 text-amber-800',
};

export default function AdminContestsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [taken, setTaken] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState<NewContest | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // 展開哪一場比賽的報名名單
  const [entriesFor, setEntriesFor] = useState<string | null>(null);
  const [entries, setEntries] = useState<ContestEntry[]>([]);

  async function reload() {
    const rows = await listAllContests();
    setContests(rows);
    setTaken(await getTakenCounts(rows.map((item) => item.id)));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function startEdit(contest: Contest) {
    setEditingId(contest.id);
    setForm({
      title: contest.title,
      description: contest.description ?? '',
      event_date: contest.event_date,
      location: contest.location,
      signup_deadline: contest.signup_deadline,
      capacity: contest.capacity,
      min_grade: contest.min_grade,
      max_grade: contest.max_grade,
      status: contest.status,
    });
    setError('');
  }

  function patch(next: Partial<NewContest>) {
    setForm((current) => (current ? { ...current, ...next } : current));
  }

  const titleIme = useImeGuardedInput((title) => patch({ title }));
  const locationIme = useImeGuardedInput((location) => patch({ location }));
  const descriptionIme = useImeGuardedInput<HTMLTextAreaElement>((description) =>
    patch({ description })
  );

  /*
    資料庫有同樣的檢查限制式，這裡先擋一次只是為了給看得懂的訊息 ——
    直接讓 contests_grade_range 跳錯，行政人員只會看到一句英文。
  */
  function validate(value: NewContest): string | null {
    if (value.title.trim() === '') return '請填寫比賽名稱';
    if (value.location.trim() === '') return '請填寫比賽地點';
    if (value.event_date === '') return '請選擇比賽日期';
    if (value.signup_deadline === '') return '請選擇報名截止日';
    if (value.signup_deadline > value.event_date)
      return '報名截止日不能晚於比賽日期';
    const min = gradeRank(value.min_grade);
    const max = gradeRank(value.max_grade);
    if (min === null || max === null || min > max)
      return '參賽年級的範圍不正確，最低年級不能高於最高年級';
    if (value.capacity !== null && value.capacity <= 0)
      return '名額上限要大於 0，不限名額請留空';
    return null;
  }

  async function handleSave() {
    if (!form) return;
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }

    const payload: NewContest = {
      ...form,
      title: form.title.trim(),
      location: form.location.trim(),
      // 可空欄位的空字串轉成 null，資料庫才不會存下一個看似有值的空白
      description:
        form.description === null || form.description.trim() === ''
          ? null
          : form.description.trim(),
    };

    setSaving(true);
    const { error: saveError } = editingId
      ? await updateContest(editingId, payload)
      : await createContest(payload).then((result) => ({ error: result.error }));
    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }
    setForm(null);
    setEditingId(null);
    await reload();
  }

  async function handleChangeStatus(contest: Contest, status: ContestStatus) {
    const { error: statusError } = await updateContest(contest.id, {
      title: contest.title,
      description: contest.description,
      event_date: contest.event_date,
      location: contest.location,
      signup_deadline: contest.signup_deadline,
      capacity: contest.capacity,
      min_grade: contest.min_grade,
      max_grade: contest.max_grade,
      status,
    });
    if (statusError) {
      setError(statusError);
      return;
    }
    await reload();
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await deleteContest(id);
    setConfirmingDeleteId(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    if (entriesFor === id) setEntriesFor(null);
    await reload();
  }

  async function toggleEntries(contestId: string) {
    if (entriesFor === contestId) {
      setEntriesFor(null);
      return;
    }
    setEntriesFor(contestId);
    setEntries(await listContestEntries(contestId));
  }

  async function handleEntryStatus(
    entry: ContestEntry,
    status: RegistrationStatus
  ) {
    const { error: entryError } = await updateEntryStatus(entry.id, status);
    if (entryError) {
      setError(entryError);
      return;
    }
    setEntries(await listContestEntries(entry.contest_id));
    // 取消會讓出名額，人數要跟著更新
    setTaken(await getTakenCounts(contests.map((item) => item.id)));
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
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">比賽管理</h1>
            <Link to="/admin" className="text-sm text-brand-600 underline">
              回報名管理
            </Link>
          </div>
          {form === null && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              新增比賽
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {form && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? '編輯比賽' : '新增比賽'}
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="contest_title"
                  className="block text-sm font-medium text-slate-700"
                >
                  比賽名稱
                </label>
                <input
                  id="contest_title"
                  type="text"
                  value={form.title}
                  onChange={titleIme.onChange}
                  onCompositionStart={titleIme.onCompositionStart}
                  onCompositionEnd={titleIme.onCompositionEnd}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="contest_event_date"
                  className="block text-sm font-medium text-slate-700"
                >
                  比賽日期
                </label>
                <input
                  id="contest_event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(event) => patch({ event_date: event.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="contest_deadline"
                  className="block text-sm font-medium text-slate-700"
                >
                  報名截止日
                </label>
                <input
                  id="contest_deadline"
                  type="date"
                  value={form.signup_deadline}
                  onChange={(event) =>
                    patch({ signup_deadline: event.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="contest_location"
                  className="block text-sm font-medium text-slate-700"
                >
                  地點
                </label>
                <input
                  id="contest_location"
                  type="text"
                  value={form.location}
                  onChange={locationIme.onChange}
                  onCompositionStart={locationIme.onCompositionStart}
                  onCompositionEnd={locationIme.onCompositionEnd}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="contest_min_grade"
                  className="block text-sm font-medium text-slate-700"
                >
                  最低年級
                </label>
                <select
                  id="contest_min_grade"
                  value={form.min_grade}
                  onChange={(event) => patch({ min_grade: event.target.value })}
                  className={INPUT_CLASS}
                >
                  {ALL_GRADES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="contest_max_grade"
                  className="block text-sm font-medium text-slate-700"
                >
                  最高年級
                </label>
                <select
                  id="contest_max_grade"
                  value={form.max_grade}
                  onChange={(event) => patch({ max_grade: event.target.value })}
                  className={INPUT_CLASS}
                >
                  {ALL_GRADES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contest_capacity"
                    className="block text-sm font-medium text-slate-700"
                  >
                    名額上限
                  </label>
                  <span
                    id="contest_capacity-hint"
                    className="text-xs font-normal text-slate-400"
                  >
                    （留空＝不限）
                  </span>
                </div>
                <input
                  id="contest_capacity"
                  type="number"
                  min={1}
                  value={form.capacity ?? ''}
                  onChange={(event) =>
                    patch({
                      capacity:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  aria-describedby="contest_capacity-hint"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor="contest_status"
                  className="block text-sm font-medium text-slate-700"
                >
                  狀態
                </label>
                <select
                  id="contest_status"
                  value={form.status}
                  onChange={(event) =>
                    patch({ status: event.target.value as ContestStatus })
                  }
                  className={INPUT_CLASS}
                >
                  {(Object.keys(CONTEST_STATUS_LABELS) as ContestStatus[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {CONTEST_STATUS_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contest_description"
                    className="block text-sm font-medium text-slate-700"
                  >
                    說明
                  </label>
                  <span
                    id="contest_description-optional"
                    className="text-xs font-normal text-slate-400"
                  >
                    （選填）
                  </span>
                </div>
                <textarea
                  id="contest_description"
                  rows={4}
                  value={form.description ?? ''}
                  onChange={descriptionIme.onChange}
                  onCompositionStart={descriptionIme.onCompositionStart}
                  onCompositionEnd={descriptionIme.onCompositionEnd}
                  aria-describedby="contest_description-optional"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? '儲存中…' : '儲存'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(null);
                  setEditingId(null);
                  setError('');
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </section>
        )}

        {contests.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            還沒有任何比賽
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {contests.map((contest) => {
              const count = taken.get(contest.id) ?? 0;
              return (
                <li
                  key={contest.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {contest.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {contest.event_date} · {contest.location} · 報名截止{' '}
                        {contest.signup_deadline}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatGrade(contest.min_grade)}至
                        {formatGrade(contest.max_grade)} · 已報名 {count}
                        {contest.capacity === null
                          ? ' 人（不限名額）'
                          : ` / ${contest.capacity} 人`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLES[contest.status]
                      }`}
                    >
                      {CONTEST_STATUS_LABELS[contest.status]}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => toggleEntries(contest.id)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      {entriesFor === contest.id ? '收起名單' : '看報名名單'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(contest)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      編輯
                    </button>
                    {contest.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(contest, 'published')}
                        className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
                      >
                        發佈
                      </button>
                    )}
                    {contest.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(contest, 'closed')}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        關閉報名
                      </button>
                    )}
                    {confirmingDeleteId === contest.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(contest.id)}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                        >
                          確定刪除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                        >
                          取消
                        </button>
                        <span className="self-center text-sm text-red-700">
                          {count > 0
                            ? `這場比賽有 ${count} 筆報名，會一併刪除`
                            : '刪除後無法復原'}
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(contest.id)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        刪除
                      </button>
                    )}
                  </div>

                  {entriesFor === contest.id && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {entries.length === 0 ? (
                        <p className="text-sm text-slate-500">還沒有人報名</p>
                      ) : (
                        <ul className="space-y-2">
                          {entries.map((entry) => (
                            <li
                              key={entry.id}
                              className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <span className="font-medium text-slate-800">
                                {entry.student_name}
                              </span>
                              <span className="text-sm text-slate-500">
                                {formatGrade(entry.grade)}
                              </span>
                              <StatusBadge status={entry.status} />
                              <select
                                value={entry.status}
                                onChange={(event) =>
                                  handleEntryStatus(
                                    entry,
                                    event.target.value as RegistrationStatus
                                  )
                                }
                                aria-label={`${entry.student_name} 的狀態`}
                                className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-sm"
                              >
                                {(
                                  Object.keys(STATUS_LABELS) as RegistrationStatus[]
                                ).map((key) => (
                                  <option key={key} value={key}>
                                    {STATUS_LABELS[key]}
                                  </option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                      )}
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
