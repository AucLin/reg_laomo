import SchoolSelector, { type SchoolSelection } from './SchoolSelector';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import type { NewStudent } from '../lib/students';
import { studentSchema } from '../lib/validation/student';
import {
  getGradeOptions,
  type Gender,
  type SchoolLevel,
  type StudentWithSchool,
} from '../lib/types';

export interface StudentFormValue {
  name: string;
  gender: Gender | '';
  birthday: string;
  level: SchoolLevel;
  schoolId: string;
  schoolNameRaw: string;
  grade: string;
  className: string;
}

export const EMPTY_STUDENT_FORM: StudentFormValue = {
  name: '',
  gender: '',
  birthday: '',
  level: 'elementary',
  schoolId: '',
  schoolNameRaw: '',
  grade: '',
  className: '',
};

/** 把資料庫的孩子資料轉成表單值，編輯既有孩子時用 */
export function studentToFormValue(student: StudentWithSchool): StudentFormValue {
  return {
    name: student.name,
    gender: student.gender,
    birthday: student.birthday,
    // school_level 是左連接來的，自由文字校名的孩子會是 null，
    // 這時退回國小當預設，家長可以自己改
    level: student.school_level ?? 'elementary',
    schoolId: student.school_id ?? '',
    schoolNameRaw: student.school_name_raw ?? '',
    grade: student.grade,
    className: student.class_name ?? '',
  };
}

/**
 * 驗證表單值並轉成可寫入資料庫的內容。
 *
 * 可空欄位一律把空字串轉成 null：資料庫的 students_school_required 用
 * IS NOT NULL 判斷有沒有選學校，空字串會讓那條檢查限制式形同虛設。
 */
export function parseStudentForm(
  value: StudentFormValue
):
  | { ok: true; data: Omit<NewStudent, 'parent_id'> }
  | { ok: false; message: string } {
  const parsed = studentSchema.safeParse({
    name: value.name,
    gender: value.gender,
    birthday: value.birthday,
    school_level: value.level,
    school_id: value.schoolId,
    school_name_raw: value.schoolNameRaw,
    grade: value.grade,
    class_name: value.className,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      gender: parsed.data.gender,
      birthday: parsed.data.birthday,
      school_id: parsed.data.school_id === '' ? null : parsed.data.school_id,
      school_name_raw:
        parsed.data.school_name_raw === '' ? null : parsed.data.school_name_raw,
      grade: parsed.data.grade,
      class_name: parsed.data.class_name === '' ? null : parsed.data.class_name,
    },
  };
}

interface Props {
  value: StudentFormValue;
  onChange: (next: StudentFormValue) => void;
  /** 同一頁出現兩個以上的表單時用來區隔欄位代碼，避免 label 指到別人的欄位 */
  idPrefix?: string;
}

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

/**
 * 孩子資料的表單欄位。報名表與「我的孩子」管理區共用同一份 ——
 * 兩邊各寫一份的話，欄位規則遲早會分岐。
 */
export default function StudentForm({ value, onChange, idPrefix = '' }: Props) {
  const id = (name: string) => `${idPrefix}${name}`;

  function patch(next: Partial<StudentFormValue>) {
    onChange({ ...value, ...next });
  }

  const nameIme = useImeGuardedInput((name) => patch({ name }));
  const classIme = useImeGuardedInput((className) => patch({ className }));

  function handleSchoolChange(next: SchoolSelection) {
    // 級別換了，原本選的年級一定不再適用，清掉逼使用者重選
    patch({
      level: next.level,
      schoolId: next.schoolId,
      schoolNameRaw: next.schoolNameRaw,
      grade: next.level === value.level ? value.grade : '',
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={id('student_name')}
            className="block text-sm font-medium text-slate-700"
          >
            學生姓名
          </label>
          <input
            id={id('student_name')}
            type="text"
            value={value.name}
            onChange={nameIme.onChange}
            onCompositionStart={nameIme.onCompositionStart}
            onCompositionEnd={nameIme.onCompositionEnd}
            className={INPUT_CLASS}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">性別</legend>
          <div className="mt-2 flex gap-3">
            {(['male', 'female'] as const).map((option) => (
              <label
                key={option}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm transition ${
                  value.gender === option
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name={id('gender')}
                  className="sr-only"
                  checked={value.gender === option}
                  onChange={() => patch({ gender: option })}
                  aria-label={option === 'male' ? '男' : '女'}
                />
                {option === 'male' ? '男' : '女'}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor={id('birthday')}
            className="block text-sm font-medium text-slate-700"
          >
            生日
          </label>
          <input
            id={id('birthday')}
            type="date"
            value={value.birthday}
            onChange={(event) => patch({ birthday: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          {/*
            「（選填）」放在 label 外面而不是塞進 <label> 裡：測試工具算
            label 的可存取名稱時會把子節點文字全部串起來，塞在裡面會讓
            getByLabelText('班級') 比對到「班級（選填）」而找不到欄位。
            用 aria-describedby 把提示跟輸入框語意連結起來，螢幕閱讀器
            使用者才聽得到「選填」。
          */}
          <div className="flex items-center justify-between">
            <label
              htmlFor={id('class_name')}
              className="block text-sm font-medium text-slate-700"
            >
              班級
            </label>
            <span
              id={id('class_name-optional')}
              className="text-xs font-normal text-slate-400"
            >
              （選填）
            </span>
          </div>
          <input
            id={id('class_name')}
            type="text"
            value={value.className}
            onChange={classIme.onChange}
            onCompositionStart={classIme.onCompositionStart}
            onCompositionEnd={classIme.onCompositionEnd}
            aria-describedby={id('class_name-optional')}
            placeholder="例如：忠班"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <SchoolSelector
        value={{
          level: value.level,
          schoolId: value.schoolId,
          schoolNameRaw: value.schoolNameRaw,
        }}
        onChange={handleSchoolChange}
      />

      <div className="sm:max-w-xs">
        <label
          htmlFor={id('grade')}
          className="block text-sm font-medium text-slate-700"
        >
          年級
        </label>
        <select
          id={id('grade')}
          value={value.grade}
          onChange={(event) => patch({ grade: event.target.value })}
          className={INPUT_CLASS}
        >
          <option value="">請選擇</option>
          {getGradeOptions(value.level).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
