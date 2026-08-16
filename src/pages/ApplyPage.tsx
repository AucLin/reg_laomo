import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppHeader from '../components/AppHeader';
import SchoolSelector, { type SchoolSelection } from '../components/SchoolSelector';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import {
  createRegistration,
  getRegistration,
  updateRegistration,
} from '../lib/registrations';
import { registrationSchema } from '../lib/validation/registration';
import { getGradeOptions, RELATION_LABELS, type Relation } from '../lib/types';

export default function ApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // 網址帶 ?edit=<報名代碼> 就是修改既有報名，否則是新報名
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = editId !== null;

  const [studentName, setStudentName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [birthday, setBirthday] = useState('');
  const [school, setSchool] = useState<SchoolSelection>({
    level: 'elementary',
    schoolId: '',
    schoolNameRaw: '',
  });
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [parentName, setParentName] = useState(profile?.full_name ?? '');
  const [relation, setRelation] = useState<Relation | ''>('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // getRegistration 在「查無此筆」「RLS 擋下別人的報名」「查詢出錯」
  // 三種情況都回傳 null，此時要明確告知家長，不能讓畫面停在
  // 「標題顯示修改、欄位卻全部空白」這種看不出原因的狀態。
  const [editError, setEditError] = useState('');

  const studentNameIme = useImeGuardedInput(setStudentName);
  const classNameIme = useImeGuardedInput(setClassName);
  const parentNameIme = useImeGuardedInput(setParentName);

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
      setStudentName(existing.student_name);
      setGender(existing.student_gender);
      setBirthday(existing.student_birthday);
      setSchool({
        // school_level 是左連接來的，自由文字校名的報名會是 null，
        // 這時退回國小當預設，家長可以自己改
        level: existing.school_level ?? 'elementary',
        schoolId: existing.school_id ?? '',
        schoolNameRaw: existing.school_name_raw ?? '',
      });
      setGrade(existing.grade);
      setClassName(existing.class_name ?? '');
      setParentName(existing.parent_name);
      setRelation(existing.relation);
      setPhone(existing.contact_phone);
    });
    return () => {
      active = false;
    };
  }, [editId]);

  function handleSchoolChange(next: SchoolSelection) {
    // 級別換了，原本選的年級一定不再適用，清掉逼使用者重選
    if (next.level !== school.level) setGrade('');
    setSchool(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const parsed = registrationSchema.safeParse({
      student_name: studentName,
      student_gender: gender,
      student_birthday: birthday,
      school_level: school.level,
      school_id: school.schoolId,
      school_name_raw: school.schoolNameRaw,
      grade,
      class_name: className,
      parent_name: parentName,
      relation,
      contact_phone: phone,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    if (!user) {
      setError('登入狀態已失效，請重新登入');
      return;
    }

    // 資料庫用 IS NOT NULL 判斷「有沒有選學校 / 有沒有填班級」，
    // 若把 Zod 驗證通過的空字串原樣寫進去，'' IS NOT NULL 永遠成立，
    // school_required 這條檢查限制式就形同虛設。可空欄位一律把空字串轉成 null 再送出。
    const payload = {
      student_name: parsed.data.student_name,
      student_gender: parsed.data.student_gender,
      student_birthday: parsed.data.student_birthday,
      school_id: parsed.data.school_id === '' ? null : parsed.data.school_id,
      school_name_raw:
        parsed.data.school_name_raw === '' ? null : parsed.data.school_name_raw,
      grade: parsed.data.grade,
      class_name: parsed.data.class_name === '' ? null : parsed.data.class_name,
      parent_name: parsed.data.parent_name,
      relation: parsed.data.relation,
      contact_phone: parsed.data.contact_phone,
    };

    setSubmitting(true);
    const { error: submitError } = isEditing
      ? await updateRegistration(editId!, payload)
      : await createRegistration({ ...payload, parent_id: user.id });
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

        <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">學生資訊</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="student_name"
                  className="block text-sm font-medium text-slate-700"
                >
                  學生姓名
                </label>
                <input
                  id="student_name"
                  type="text"
                  value={studentName}
                  onChange={studentNameIme.onChange}
                  onCompositionStart={studentNameIme.onCompositionStart}
                  onCompositionEnd={studentNameIme.onCompositionEnd}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-slate-700">性別</legend>
                <div className="mt-2 flex gap-3">
                  {(['male', 'female'] as const).map((option) => (
                    <label
                      key={option}
                      className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm transition ${
                        gender === option
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        className="sr-only"
                        checked={gender === option}
                        onChange={() => setGender(option)}
                        aria-label={option === 'male' ? '男' : '女'}
                      />
                      {option === 'male' ? '男' : '女'}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="birthday"
                  className="block text-sm font-medium text-slate-700"
                >
                  生日
                </label>
                <input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(event) => setBirthday(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                {/*
                  「（選填）」提示刻意放在 label 外面而不是塞進 <label> 裡當子節點：
                  測試工具（testing-library）算 label 的可存取名稱時，會把 <label>
                  底下所有子節點的文字全部串起來，塞在裡面會讓 getByLabelText('班級')
                  比對到「班級（選填）」而找不到欄位。抽成同一行的相鄰元素，
                  可存取名稱仍是單純的「班級」；再用 aria-describedby 把提示
                  跟輸入框語意連結起來，螢幕閱讀器使用者用 Tab 逐欄位填表時
                  才聽得到「選填」，不會誤以為這是必填欄位。
                */}
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="class_name"
                    className="block text-sm font-medium text-slate-700"
                  >
                    班級
                  </label>
                  <span id="class_name-optional" className="text-xs font-normal text-slate-400">
                    （選填）
                  </span>
                </div>
                <input
                  id="class_name"
                  type="text"
                  value={className}
                  onChange={classNameIme.onChange}
                  onCompositionStart={classNameIme.onCompositionStart}
                  onCompositionEnd={classNameIme.onCompositionEnd}
                  aria-describedby="class_name-optional"
                  placeholder="例如：忠班"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="mt-6">
              <SchoolSelector value={school} onChange={handleSchoolChange} />
            </div>

            <div className="mt-4 sm:max-w-xs">
              <label htmlFor="grade" className="block text-sm font-medium text-slate-700">
                年級
              </label>
              <select
                id="grade"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">請選擇</option>
                {getGradeOptions(school.level).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">家長資訊</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          </section>

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
