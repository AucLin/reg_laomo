import { z } from 'zod';

/*
  孩子資料的驗證規則。

  這是從 registrationSchema 抽出來的同一組學生欄位 —— 報名表與「我的
  孩子」管理區用的是同一套規則，抽出來才不會兩邊各改各的而分岐。
  registrationSchema 保留家長欄位（姓名、關係、電話）與報名專屬的部分。
*/

/** 年級代碼的字首必須對應學校級別，避免出現「國小七年級」這種組合 */
const GRADE_PREFIX: Record<string, string> = {
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
    school_name_raw: z.string().trim(),
    grade: z.string().min(1, '請選擇年級'),
    class_name: z.string().trim(),
  })
  .refine((data) => data.school_id !== '' || data.school_name_raw !== '', {
    message: '請選擇學校或填寫學校名稱',
    path: ['school_id'],
  })
  .refine((data) => data.grade[0] === GRADE_PREFIX[data.school_level], {
    message: '年級與學校級別不符',
    path: ['grade'],
  });

export type StudentInput = z.infer<typeof studentSchema>;
