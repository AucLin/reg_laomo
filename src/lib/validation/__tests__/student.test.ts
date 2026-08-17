import { describe, it, expect } from 'vitest';
import { studentSchema } from '../student';

const valid = {
  name: '林小明',
  gender: 'male' as const,
  birthday: '2016-05-01',
  school_level: 'elementary' as const,
  school_id: 'school-1',
  school_name_raw: '',
  grade: 'E4',
  class_name: '忠班',
};

describe('studentSchema', () => {
  it('完整正確的資料通過驗證', () => {
    expect(studentSchema.safeParse(valid).success).toBe(true);
  });

  it('姓名少於 2 個字不通過', () => {
    const result = studentSchema.safeParse({ ...valid, name: '林' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('學生姓名至少 2 個字');
    }
  });

  it('學校兩種都沒填不通過', () => {
    // 選自名錄與自由填寫至少要有一個，與資料庫的 students_school_required
    // 是同一條規則
    const result = studentSchema.safeParse({
      ...valid,
      school_id: '',
      school_name_raw: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('請選擇學校或填寫學校名稱');
    }
  });

  it('只填自由文字校名也通過', () => {
    const result = studentSchema.safeParse({
      ...valid,
      school_id: '',
      school_name_raw: '某某實驗教育機構',
    });
    expect(result.success).toBe(true);
  });

  it('年級字首與學校級別不符不通過', () => {
    // 「國小七年級」這種組合要擋掉
    const result = studentSchema.safeParse({
      ...valid,
      school_level: 'elementary',
      grade: 'J1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('年級與學校級別不符');
    }
  });

  it('沒選年級不通過', () => {
    const result = studentSchema.safeParse({ ...valid, grade: '' });
    expect(result.success).toBe(false);
  });

  it('班級可以留空', () => {
    expect(studentSchema.safeParse({ ...valid, class_name: '' }).success).toBe(true);
  });

  it('生日太早（超過就學年齡上限）不通過', () => {
    // 1990-01-01 無論今天是哪一天都必然超過 MAX_AGE，不用怕測試隨日期飄移
    const result = studentSchema.safeParse({ ...valid, birthday: '1990-01-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '生日不合理，就讀學生年齡應介於 5 至 20 歲'
      );
    }
  });

  it('生日在未來不通過', () => {
    const result = studentSchema.safeParse({ ...valid, birthday: '2099-01-01' });
    expect(result.success).toBe(false);
  });

  it('合理生日通過（沿用預設樣本，本來就在就學年齡範圍內）', () => {
    expect(studentSchema.safeParse(valid).success).toBe(true);
  });

  it('學校名稱超過 50 個字不通過', () => {
    const result = studentSchema.safeParse({
      ...valid,
      school_id: '',
      school_name_raw: '某'.repeat(51),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('學校名稱最多 50 個字');
    }
  });

  it('班級名稱超過 20 個字不通過', () => {
    const result = studentSchema.safeParse({ ...valid, class_name: '班'.repeat(21) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('班級最多 20 個字');
    }
  });
});
