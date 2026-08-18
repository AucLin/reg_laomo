import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppHeader from '../components/AppHeader';
import StudentForm, {
  EMPTY_STUDENT_FORM,
  parseStudentForm,
  type StudentFormValue,
} from '../components/StudentForm';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import {
  createRegistration,
  getRegistration,
  updateRegistration,
} from '../lib/registrations';
import { createStudent, listMyStudents } from '../lib/students';
import { registrationSchema } from '../lib/validation/registration';
import {
  formatGrade,
  levelFromGrade,
  RELATION_LABELS,
  type Relation,
  type StudentWithSchool,
} from '../lib/types';

/** 一筆報名要記下來的學生資料，也就是送出當下的快照 */
interface StudentSnapshot {
  name: string;
  gender: 'male' | 'female';
  birthday: string;
  school_id: string | null;
  school_name_raw: string | null;
  grade: string;
  class_name: string | null;
}

export default function ApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // 網址帶 ?edit=<報名代碼> 就是修改既有報名，否則是新報名
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = editId !== null;

  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [studentDraft, setStudentDraft] =
    useState<StudentFormValue>(EMPTY_STUDENT_FORM);

  const [parentName, setParentName] = useState(profile?.full_name ?? '');
  const [relation, setRelation] = useState<Relation | ''>('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // getRegistration 在「查無此筆」「RLS 擋下別人的報名」「查詢出錯」
  // 三種情況都回傳 null，此時要明確告知家長，不能讓畫面停在
  // 「標題顯示修改、欄位卻全部空白」這種看不出原因的狀態。
  const [editError, setEditError] = useState('');

  const parentNameIme = useImeGuardedInput(setParentName);

  /*
    一個孩子都還沒建、或家長主動要新增，就直接展開表單；否則給清單挑。
    修改既有報名時也走表單 —— 那一筆的學生欄位是當初的快照，要能就地改。
  */
  const showStudentForm = isEditing || addingNew || students.length === 0;

  useEffect(() => {
    if (isEditing) return;
    let active = true;
    listMyStudents().then((rows) => {
      if (!active) return;
      setStudents(rows);
      // 只有一個孩子就先幫他選好，最常見的情況少點一下
      if (rows.length === 1) setSelectedStudentId(rows[0].id);
    });
    return () => {
      active = false;
    };
  }, [isEditing]);

  // 編輯模式：把既有內容載進表單
  useEffect(() => {
    if (!editId) return;
    // 元件卸載後（例如使用者切走頁面）就不該再對已經不存在的元件呼叫
    // setState，沿用 AuthProvider.tsx／SchoolSelector.tsx 已有的旗標慣例
    let active = true;
    getRegistration(editId).then((existing) => {
      if (!active) return;
      if (!existing) {
        setEditError('找不到這筆報名，可能已被刪除或不屬於您');
        return;
      }
      setStudentDraft({
        name: existing.student_name,
        gender: existing.student_gender,
        birthday: existing.student_birthday,
        // school_level 是左連接來的，自由文字校名的報名會是 null，
        // 這時退回國小當預設，家長可以自己改
        level: existing.school_level ?? 'elementary',
        schoolId: existing.school_id ?? '',
        schoolNameRaw: existing.school_name_raw ?? '',
        grade: existing.grade,
        className: existing.class_name ?? '',
      });
      setParentName(existing.parent_name);
      setRelation(existing.relation);
      setPhone(existing.contact_phone);
    });
    return () => {
      active = false;
    };
  }, [editId]);

  function startAddNew() {
    setAddingNew(true);
    setStudentDraft(EMPTY_STUDENT_FORM);
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!user) {
      setError('登入狀態已失效，請重新登入');
      return;
    }

    // 先決定這筆報名記在哪個孩子名下，以及要寫進報名的學生快照
    let studentId = selectedStudentId;
    let snapshot: StudentSnapshot;

    if (showStudentForm) {
      const parsed = parseStudentForm(studentDraft);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      snapshot = parsed.data;
    } else {
      const picked = students.find((item) => item.id === selectedStudentId);
      if (!picked) {
        setError('請選擇一個孩子');
        return;
      }
      snapshot = {
        name: picked.name,
        gender: picked.gender,
        birthday: picked.birthday,
        school_id: picked.school_id,
        school_name_raw: picked.school_name_raw,
        grade: picked.grade,
        class_name: picked.class_name,
      };
    }

    const parsed = registrationSchema.safeParse({
      student_name: snapshot.name,
      student_gender: snapshot.gender,
      student_birthday: snapshot.birthday,
      // 級別由年級代碼反推，不用孩子的 school_level —— 後者是左連接來的，
      // 自由填寫校名的孩子會是 null
      school_level: levelFromGrade(snapshot.grade),
      school_id: snapshot.school_id ?? '',
      school_name_raw: snapshot.school_name_raw ?? '',
      grade: snapshot.grade,
      class_name: snapshot.class_name ?? '',
      parent_name: parentName,
      relation,
      contact_phone: phone,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    // 可空欄位一律把空字串轉成 null 再送出：資料庫用 IS NOT NULL 判斷
    // 「有沒有選學校 / 有沒有填班級」，空字串會讓那條檢查限制式形同虛設。
    const payload = {
      student_name: snapshot.name,
      student_gender: snapshot.gender,
      student_birthday: snapshot.birthday,
      school_id: snapshot.school_id,
      school_name_raw: snapshot.school_name_raw,
      grade: snapshot.grade,
      class_name: snapshot.class_name,
      parent_name: parsed.data.parent_name,
      relation: parsed.data.relation,
      contact_phone: parsed.data.contact_phone,
    };

    setSubmitting(true);

    // 新報名而且是新孩子：先把孩子建起來，拿到代碼才能寫報名
    if (!isEditing && showStudentForm) {
      const created = await createStudent({
        parent_id: user.id,
        name: snapshot.name,
        gender: snapshot.gender,
        birthday: snapshot.birthday,
        school_id: snapshot.school_id,
        school_name_raw: snapshot.school_name_raw,
        grade: snapshot.grade,
        class_name: snapshot.class_name,
      });
      if (!created.id) {
        // 這個 return 不可省：孩子沒建起來就寫報名，會撞外鍵錯誤
        setSubmitting(false);
        setError(created.error ?? '新增失敗，請稍後再試');
        return;
      }
      studentId = created.id;
    }

    const { error: submitError } = isEditing
      ? await updateRegistration(editId!, payload)
      : await createRegistration({
          ...payload,
          parent_id: user.id,
          student_id: studentId,
        });
    setSubmitting(false);

    if (submitError) {
      setError(submitError);
      return;
    }

    navigate('/my', { replace: true, state: { justSubmitted: true } });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {isEditing ? '修改報名資訊' : '機器人課程報名'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {isEditing
            ? '修改後會重新送出，狀態維持待審核。'
            : '請填寫孩子的基本資料，我們會盡快與您聯繫。'}
        </p>

        {editError && (
          <p
            role="alert"
            className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {editError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
          <FormSection
            step={1}
            title={showStudentForm && !isEditing ? '新增孩子' : '學生資訊'}
          >
            {showStudentForm ? (
              <>
                <StudentForm value={studentDraft} onChange={setStudentDraft} />
                {addingNew && students.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddingNew(false)}
                    className="mt-4 text-sm text-brand-600 underline"
                  >
                    改為挑選既有的孩子
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      selectedStudentId === student.id
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="student"
                      className="mt-1"
                      checked={selectedStudentId === student.id}
                      onChange={() => setSelectedStudentId(student.id)}
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {student.name}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {formatGrade(student.grade)}
                        {' · '}
                        {student.school_name ?? student.school_name_raw}
                      </span>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={startAddNew}
                  className="text-sm text-brand-600 underline"
                >
                  改為新增一位孩子
                </button>
              </div>
            )}
          </FormSection>

          <FormSection step={2} title="家長資訊">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="parent_name"
                  className="block text-sm font-medium text-slate-700"
                >
                  家長姓名
                </label>
                <input
                  id="parent_name"
                  type="text"
                  value={parentName}
                  onChange={parentNameIme.onChange}
                  onCompositionStart={parentNameIme.onCompositionStart}
                  onCompositionEnd={parentNameIme.onCompositionEnd}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="relation"
                  className="block text-sm font-medium text-slate-700"
                >
                  與學生關係
                </label>
                <select
                  id="relation"
                  value={relation}
                  onChange={(event) => setRelation(event.target.value as Relation)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">請選擇</option>
                  {(Object.keys(RELATION_LABELS) as Relation[]).map((key) => (
                    <option key={key} value={key}>
                      {RELATION_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="contact_phone"
                  className="block text-sm font-medium text-slate-700"
                >
                  聯絡電話
                </label>
                <input
                  id="contact_phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          </FormSection>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || editError !== ''}
            className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {submitting ? '送出中…' : isEditing ? '儲存修改' : '送出報名'}
          </button>
        </form>
      </div>
    </div>
  );
}

/*
  表單的一段。編號徽章與標題下的分隔線是為了讓家長一眼看出「總共幾段、
  現在在第幾段」—— 各段共用同一種白卡片、標題大小也一樣的話，整頁看
  起來只是一長串欄位。
*/
function FormSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
        >
          {step}
        </span>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
