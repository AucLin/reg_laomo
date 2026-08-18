import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Download, Eye, Share2 } from 'lucide-react';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import StatusBadge from '../components/StatusBadge';
import Spinner, { PageLoading } from '../components/Spinner';
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
import { importContestFromUrl } from '../lib/contestImport';
import {
  describeParsed,
  parseContestText,
  type ParsedContest,
} from '../lib/contestParse';
import {
  buildShareText,
  contestUrl,
  copyToClipboard,
  facebookShareUrl,
  lineShareUrl,
} from '../lib/share';
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

/*
  三個級別的年級混在同一個下拉選單裡，就不能用 getGradeOptions 的標籤 ——
  它給的是「一年級」，國小、國中、高中職各有一個，選單上會出現三個
  一模一樣的「一年級」，管理員根本分不出選到哪一個。改用 formatGrade
  的完整寫法「國小一年級」。
*/
const ALL_GRADES = [
  ...getGradeOptions('elementary'),
  ...getGradeOptions('junior'),
  ...getGradeOptions('senior'),
].map((option) => ({ value: option.value, label: formatGrade(option.value) }));

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
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // 哪一場比賽正在等網路回應（發佈、關閉、刪除）
  const [busyContestId, setBusyContestId] = useState<string | null>(null);
  // 展開哪一場比賽的報名名單
  const [entriesFor, setEntriesFor] = useState<string | null>(null);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  // 展開哪一場比賽的分享面板，以及複製後的提示
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState('');

  // 從比賽官網帶入：網址或直接貼上公告文字
  const [importMode, setImportMode] = useState<'url' | 'text'>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState('');

  /*
    只帶入抓到的欄位，抓不到的維持原樣 —— 用空值蓋掉已經填好的內容是最
    惱人的行為。年級、名額、狀態一律不碰：公告上寫的分組方式跟這裡的
    年級代碼對不起來，猜錯比留空更糟。
  */
  function applyParsed(parsed: ParsedContest, sourceLink: string | null) {
    const descriptionWithLink =
      parsed.description && sourceLink
        ? `${parsed.description}\n\n活動網址：${sourceLink}`
        : parsed.description;

    patch({
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.event_date ? { event_date: parsed.event_date } : {}),
      ...(parsed.signup_deadline
        ? { signup_deadline: parsed.signup_deadline }
        : {}),
      ...(parsed.location ? { location: parsed.location } : {}),
      ...(descriptionWithLink ? { description: descriptionWithLink } : {}),
    });
    setImportNote(describeParsed(parsed));
  }

  async function handleImportFromUrl() {
    setImporting(true);
    setImportNote('');
    const { parsed, sourceUrl: finalUrl, error: importError } =
      await importContestFromUrl(sourceUrl.trim());
    setImporting(false);

    if (!parsed) {
      setImportNote(importError ?? '讀取失敗，請稍後再試');
      return;
    }
    applyParsed(parsed, finalUrl);
  }

  function handleImportFromText() {
    setImportNote('');
    // 貼上的文字在瀏覽器裡就解析得完，不必往返伺服器
    applyParsed(parseContestText(sourceText), null);
  }

  async function handleCopy(text: string, label: string) {
    const ok = await copyToClipboard(text);
    // 複製失敗要說出來。靜靜地什麼都沒發生，管理員會以為複製好了
    setCopyNote(ok ? `已複製${label}` : '複製失敗，請手動選取後複製');
    // 提示留一下就收掉，不然一直掛在那裡會讓人以為是狀態而不是剛才的動作
    window.setTimeout(() => setCopyNote(''), 3000);
  }

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
    setFormError('');
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
    setFormError('');
    setError('');
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
    setFormError('');
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
    直接讓 contests_grade_range 跳錯，管理員只會看到一句英文。
  */
  function validate(value: NewContest): string | null {
    if (value.title.trim() === '') return '請填寫比賽名稱';
    if (value.event_date === '') return '請選擇比賽日期';
    if (value.signup_deadline === '') return '請選擇報名截止日';
    if (value.location.trim() === '') return '請填寫比賽地點';
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
      setFormError(problem);
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

    if (saveError) {
      setSaving(false);
      setFormError(saveError);
      return;
    }
    await reload();
    setSaving(false);
    closeForm();
  }

  async function handleChangeStatus(contest: Contest, status: ContestStatus) {
    setBusyContestId(contest.id);
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
      setBusyContestId(null);
      setError(statusError);
      return;
    }
    await reload();
    setBusyContestId(null);
  }

  async function handleDelete(id: string) {
    setBusyContestId(id);
    const { error: deleteError } = await deleteContest(id);
    setConfirmingDeleteId(null);
    if (deleteError) {
      setBusyContestId(null);
      setError(deleteError);
      return;
    }
    if (entriesFor === id) setEntriesFor(null);
    await reload();
    setBusyContestId(null);
  }

  async function toggleEntries(contestId: string) {
    if (entriesFor === contestId) {
      setEntriesFor(null);
      return;
    }
    setEntriesFor(contestId);
    setEntries([]);
    setLoadingEntries(true);
    setEntries(await listContestEntries(contestId));
    setLoadingEntries(false);
  }

  async function handleEntryStatus(
    entry: ContestEntry,
    status: RegistrationStatus
  ) {
    setBusyEntryId(entry.id);
    const { error: entryError } = await updateEntryStatus(entry.id, status);
    if (entryError) {
      setBusyEntryId(null);
      setError(entryError);
      return;
    }
    setEntries(await listContestEntries(entry.contest_id));
    // 取消會讓出名額，人數要跟著更新
    setTaken(await getTakenCounts(contests.map((item) => item.id)));
    setBusyEntryId(null);
  }

  // 外框（頁首、側邊欄、底色）由 AdminLayout 提供，這裡只出載入中的內容
  if (loading) return <PageLoading label="正在讀取比賽…" />;

  return (
    <>
      <AdminPageHeader
        title="比賽管理"
        maxWidth="max-w-5xl"
        action={
          form === null && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              新增比賽
            </button>
          )
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-6">

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {form && (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? '編輯比賽' : '新增比賽'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              標示 <RequiredMark /> 的是必填。存成草稿家長看不到，要按發佈才會出現。
            </p>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            {/*
              先讓系統抓一輪墊底，再手動修。抓到的是猜的，所以是「帶入」
              而不是取代手填 —— 帶入之後每一欄都還在，照樣可以改。
            */}
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">
                自動帶入（可略過，直接手填）
              </p>

              <div className="mt-2 flex gap-2">
                <ModeTab
                  active={importMode === 'url'}
                  onClick={() => {
                    setImportMode('url');
                    setImportNote('');
                  }}
                >
                  貼網址
                </ModeTab>
                <ModeTab
                  active={importMode === 'text'}
                  onClick={() => {
                    setImportMode('text');
                    setImportNote('');
                  }}
                >
                  貼文字
                </ModeTab>
              </div>

              {importMode === 'url' ? (
                <div className="mt-3">
                  <label htmlFor="contest_source_url" className="sr-only">
                    比賽公告網址
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="contest_source_url"
                      type="url"
                      value={sourceUrl}
                      onChange={(event) => setSourceUrl(event.target.value)}
                      placeholder="https://例如主辦單位的比賽公告頁"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={handleImportFromUrl}
                      disabled={importing || sourceUrl.trim() === ''}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
                    >
                      {importing ? <Spinner /> : <Download className="h-4 w-4" />}
                      {importing ? '讀取中…' : '帶入'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor="contest_source_text" className="sr-only">
                    比賽公告文字
                  </label>
                  <textarea
                    id="contest_source_text"
                    rows={5}
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    placeholder={
                      '把公告整段貼進來，例如：\n' +
                      'WRO 2026 全國賽\n' +
                      '比賽日期：115年8月20日\n' +
                      '報名截止：115年7月31日\n' +
                      '比賽地點：臺中市第二運動場'
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleImportFromText}
                    disabled={sourceText.trim() === ''}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    解析並帶入
                  </button>
                </div>
              )}

              {importNote && (
                <p role="status" className="mt-2 text-sm text-slate-600">
                  {importNote}
                </p>
              )}
            </div>

            <FormGroup step={1} title="基本資訊">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  id="contest_title"
                  label="比賽名稱"
                  required
                >
                  <input
                    id="contest_title"
                    type="text"
                    value={form.title}
                    onChange={titleIme.onChange}
                    onCompositionStart={titleIme.onCompositionStart}
                    onCompositionEnd={titleIme.onCompositionEnd}
                    placeholder="例如：WRO 2026 全國賽"
                    className={INPUT_CLASS}
                  />
                </Field>

                <Field id="contest_event_date" label="比賽日期" required>
                  <input
                    id="contest_event_date"
                    type="date"
                    value={form.event_date}
                    onChange={(event) =>
                      patch({ event_date: event.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </Field>

                <Field
                  id="contest_deadline"
                  label="報名截止日"
                  required
                  hint="要早於或等於比賽日期"
                >
                  <input
                    id="contest_deadline"
                    type="date"
                    value={form.signup_deadline}
                    onChange={(event) =>
                      patch({ signup_deadline: event.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  id="contest_location"
                  label="地點"
                  required
                >
                  <input
                    id="contest_location"
                    type="text"
                    value={form.location}
                    onChange={locationIme.onChange}
                    onCompositionStart={locationIme.onCompositionStart}
                    onCompositionEnd={locationIme.onCompositionEnd}
                    placeholder="例如：臺北市立大學天母校區體育館"
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>
            </FormGroup>

            <FormGroup
              step={2}
              title="報名條件"
              description="不符年級的孩子在家長端會直接標示「年級不符」，按不下報名。"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="contest_min_grade" label="最低年級" required>
                  <select
                    id="contest_min_grade"
                    value={form.min_grade}
                    onChange={(event) =>
                      patch({ min_grade: event.target.value })
                    }
                    className={INPUT_CLASS}
                  >
                    {ALL_GRADES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="contest_max_grade" label="最高年級" required>
                  <select
                    id="contest_max_grade"
                    value={form.max_grade}
                    onChange={(event) =>
                      patch({ max_grade: event.target.value })
                    }
                    className={INPUT_CLASS}
                  >
                    {ALL_GRADES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id="contest_capacity"
                  label="名額上限"
                  hint="留空代表不限名額"
                >
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
                    placeholder="不限"
                    className={INPUT_CLASS}
                  />
                </Field>

                <Field
                  id="contest_status"
                  label="狀態"
                  required
                  hint="草稿只有後台看得到"
                >
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
                </Field>
              </div>
            </FormGroup>

            <FormGroup step={3} title="說明">
              <Field
                id="contest_description"
                label="給家長看的說明"
                hint="選填，會原樣顯示在比賽頁"
              >
                <textarea
                  id="contest_description"
                  rows={4}
                  value={form.description ?? ''}
                  onChange={descriptionIme.onChange}
                  onCompositionStart={descriptionIme.onCompositionStart}
                  onCompositionEnd={descriptionIme.onCompositionEnd}
                  placeholder="比賽規則、分組方式、費用、集合時間等"
                  className={INPUT_CLASS}
                />
              </Field>
            </FormGroup>
          </div>

          {/* 錯誤訊息貼著送出鈕，不要丟到整頁最上面 ——
              管理員按完儲存眼睛還停在按鈕附近 */}
          <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
            {formError && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {formError}
              </p>
            )}
            <div className="flex gap-3">
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
            const busy = busyContestId === contest.id;
            return (
              <li
                key={contest.id}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* min-w-0：flex 子元素預設不肯縮到內容以下，少了它，
                      主辦單位那種一長串的比賽名稱會把整張卡片撐破 */}
                  <div className="min-w-0 flex-1 break-words">
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

                <div className="mt-4 flex flex-wrap items-center gap-3">
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
                  {/*
                    預覽開新分頁，不要把後台的位置弄丟 —— 看完關掉分頁
                    就回到原本捲動到的地方。走的是家長看到的同一頁，
                    草稿也讀得到（列級權限只給管理員），所以看到的
                    版面跟發佈後一模一樣。
                  */}
                  <a
                    href={`/contests/${contest.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    預覽
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setSharingId(
                        sharingId === contest.id ? null : contest.id
                      );
                      setCopyNote('');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <Share2 className="h-4 w-4" />
                    分享
                  </button>
                  {contest.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => handleChangeStatus(contest, 'published')}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
                    >
                      {busy && <Spinner />}
                      發佈
                    </button>
                  )}
                  {contest.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => handleChangeStatus(contest, 'closed')}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busy && <Spinner />}
                      關閉報名
                    </button>
                  )}
                  {confirmingDeleteId === contest.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(contest.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {busy && <Spinner />}
                        確定刪除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={busy}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        取消
                      </button>
                      <span className="text-sm text-red-700">
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

                {sharingId === contest.id && (
                  <SharePanel
                    contest={contest}
                    copyNote={copyNote}
                    onCopy={handleCopy}
                  />
                )}

                {entriesFor === contest.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {loadingEntries ? (
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <Spinner />
                        正在讀取名單…
                      </p>
                    ) : entries.length === 0 ? (
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
                            <div className="ml-auto flex items-center gap-2">
                              {busyEntryId === entry.id && (
                                <Spinner className="h-4 w-4 text-slate-400" />
                              )}
                              <select
                                value={entry.status}
                                disabled={busyEntryId === entry.id}
                                onChange={(event) =>
                                  handleEntryStatus(
                                    entry,
                                    event.target.value as RegistrationStatus
                                  )
                                }
                                aria-label={`${entry.student_name} 的狀態`}
                                className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
                              >
                                {(
                                  Object.keys(
                                    STATUS_LABELS
                                  ) as RegistrationStatus[]
                                ).map((key) => (
                                  <option key={key} value={key}>
                                    {STATUS_LABELS[key]}
                                  </option>
                                ))}
                              </select>
                            </div>
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
    </>
  );
}

/*
  分享面板。連結指向 /contests/<代碼>，家長不必登入就打得開；
  草稿的比賽被列級權限擋住，打開會是「找不到這場比賽」，所以要先提醒。
*/
function SharePanel({
  contest,
  copyNote,
  onCopy,
}: {
  contest: Contest;
  copyNote: string;
  onCopy: (text: string, label: string) => void;
}) {
  const url = contestUrl(contest.id);
  const text = buildShareText(contest, url);

  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-4">
      {contest.status === 'draft' && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這場比賽還是草稿，家長打開連結會看到「找不到這場比賽」。請先按發佈。
        </p>
      )}

      <label
        htmlFor={`share-url-${contest.id}`}
        className="block text-sm font-medium text-slate-700"
      >
        報名連結
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id={`share-url-${contest.id}`}
          type="text"
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600"
        />
        <button
          type="button"
          onClick={() => onCopy(url, '連結')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <Copy className="h-4 w-4" />
          複製連結
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={lineShareUrl(url, text)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          分享到 LINE
        </a>
        <a
          href={facebookShareUrl(url)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          分享到 Facebook
        </a>
        <button
          type="button"
          onClick={() => onCopy(text, '文案')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <Copy className="h-4 w-4" />
          複製整段文案
        </button>
      </div>

      {/* 複製完成的提示要貼著按鈕。擺到最下面的話，畫面一長就看不到，
          會讓人以為沒複製到而重複按 */}
      {copyNote && (
        <p
          role="status"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {copyNote}
        </p>
      )}

      {/* 臉書只吃網址，帶不了自訂文字，所以文案要自己貼 */}
      <p className="mt-2 text-xs text-slate-500">
        臉書只會帶網址，貼文內容請用「複製整段文案」自己貼上。
      </p>

      {/* whitespace-pre-wrap 不會斷開沒有空白的長字串，文案裡的報名連結
          在手機上量到會超出容器 40px，整頁跟著能左右拉。break-words 讓
          它該斷就斷 */}
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs text-slate-600">
        {text}
      </pre>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? 'bg-white font-medium text-brand-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  );
}

/*
  表單的一組。編號徽章與底線是為了讓管理員一眼看出「這張表分成幾組」——
  十個欄位平鋪下來只是一長串輸入框，填到一半會不知道還剩多少。
*/
function FormGroup({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
        >
          {step}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {description && (
        <p className="mt-1 pl-8 text-xs text-slate-500">{description}</p>
      )}
      <div className="mt-3 pl-8">{children}</div>
    </section>
  );
}

/*
  一個欄位。提示文字放在 label 外面而不是塞進 <label> 裡：測試工具算
  label 的可存取名稱時會把子節點文字全部串起來，塞在裡面會讓
  getByLabelText('名額上限') 比對到「名額上限（留空＝不限）」而找不到欄位。
  用 aria-describedby 把提示跟輸入框語意連結起來。
*/
function Field({
  id,
  label,
  required,
  hint,
  className = '',
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {required && <RequiredMark />}
        {hint && (
          <span id={`${id}-hint`} className="text-xs font-normal text-slate-500">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
