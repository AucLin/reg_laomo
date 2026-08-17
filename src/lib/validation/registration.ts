import { z } from 'zod';
import { isValidTaiwanPhone } from './phone';
import { GRADE_PREFIX, MAX_AGE, MIN_AGE, isValidStudentBirthday } from './student';

/*
  MIN_AGE、MAX_AGE、isValidStudentBirthday、GRADE_PREFIX 的權威定義在
  student.ts —— 報名表與「我的孩子」管理區驗證的是同一組學生欄位，
  兩邊都改同一份常數與函式才不會各自漂移。這裡重新匯出
  isValidStudentBirthday 是因為既有的 registration.test.ts 是從這個
  檔案匯入它，不能因為搬家而讓既有測試壞掉。
*/
export { isValidStudentBirthday };

export const registrationSchema = z
  .object({
    student_name: z
      .string()
      .trim()
      .min(2, '學生姓名至少 2 個字')
      .max(20, '學生姓名最多 20 個字'),
    student_gender: z.enum(['male', 'female'], { message: '請選擇性別' }),
    student_birthday: z.string().min(1, '請填寫生日'),
    school_level: z.enum(['elementary', 'junior', 'senior'], {
      message: '請選擇學校級別',
    }),
    school_id: z.string(),
    school_name_raw: z.string().trim().max(50, '學校名稱最多 50 個字'),
    grade: z.string().min(1, '請選擇年級'),
    class_name: z.string().trim().max(20, '班級最多 20 個字'),
    parent_name: z
      .string()
      .trim()
      .min(2, '家長姓名至少 2 個字')
      .max(20, '家長姓名最多 20 個字'),
    relation: z.enum(['father', 'mother', 'grandparent', 'other'], {
      message: '請選擇與學生的關係',
    }),
    contact_phone: z.string().trim().min(1, '請填寫聯絡電話'),
  })
  .refine((data) => isValidStudentBirthday(data.student_birthday, new Date()), {
    message: `生日不合理，就讀學生年齡應介於 ${MIN_AGE} 至 ${MAX_AGE} 歲`,
    path: ['student_birthday'],
  })
  .refine((data) => isValidTaiwanPhone(data.contact_phone), {
    message: '電話格式不正確，請填寫手機或市話',
    path: ['contact_phone'],
  })
  .refine((data) => data.grade.startsWith(GRADE_PREFIX[data.school_level]), {
    message: '年級與學校級別不符，請重新選擇',
    path: ['grade'],
  })
  .refine((data) => data.school_id !== '' || data.school_name_raw !== '', {
    message: '請選擇就讀學校，或填寫學校名稱',
    path: ['school_id'],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
