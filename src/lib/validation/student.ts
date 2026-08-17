import { z } from 'zod';

/*
  孩子資料的驗證規則。

  這是從 registrationSchema 抽出來的同一組學生欄位 —— 報名表與「我的
  孩子」管理區用的是同一套規則，抽出來才不會兩邊各改各的而分岐。
  registrationSchema 保留家長欄位（姓名、關係、電話）與報名專屬的部分。

  MIN_AGE、MAX_AGE、isValidStudentBirthday、GRADE_PREFIX 這幾個共用
  常數與函式的權威定義放在這裡；registration.ts 改成從這裡匯入，
  避免同一條規則出現兩份、日後各自漂移。
*/

export const MIN_AGE = 5;
export const MAX_AGE = 20;

/**
 * 驗證學生生日是否落在合理的就學年齡範圍。
 * today 由呼叫端傳入而非在函式內取當下時間，測試才能給定固定日期，
 * 不會隨著時間經過自己失效。
 */
export function isValidStudentBirthday(birthday: string, today: Date): boolean {
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) return false;
  if (date > today) return false;

  const earliest = new Date(today);
  earliest.setFullYear(earliest.getFullYear() - MAX_AGE);

  const latest = new Date(today);
  latest.setFullYear(latest.getFullYear() - MIN_AGE);

  return date >= earliest && date <= latest;
}

/** 年級代碼的字首必須對應學校級別，避免出現「國小七年級」這種組合 */
export const GRADE_PREFIX: Record<string, string> = {
  elementary: 'E',
  junior: 'J',
  senior: 'S',
};

export const studentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, '學生姓名至少 2 個字')
      .max(20, '學生姓名最多 20 個字'),
    gender: z.enum(['male', 'female'], { message: '請選擇性別' }),
    birthday: z.string().min(1, '請填寫生日'),
    school_level: z.enum(['elementary', 'junior', 'senior'], {
      message: '請選擇學校級別',
    }),
    school_id: z.string(),
    school_name_raw: z.string().trim().max(50, '學校名稱最多 50 個字'),
    grade: z.string().min(1, '請選擇年級'),
    class_name: z.string().trim().max(20, '班級最多 20 個字'),
  })
  .refine((data) => data.school_id !== '' || data.school_name_raw !== '', {
    message: '請選擇學校或填寫學校名稱',
    path: ['school_id'],
  })
  .refine((data) => data.grade[0] === GRADE_PREFIX[data.school_level], {
    message: '年級與學校級別不符',
    path: ['grade'],
  })
  .refine((data) => isValidStudentBirthday(data.birthday, new Date()), {
    message: `生日不合理，就讀學生年齡應介於 ${MIN_AGE} 至 ${MAX_AGE} 歲`,
    path: ['birthday'],
  });

export type StudentInput = z.infer<typeof studentSchema>;
