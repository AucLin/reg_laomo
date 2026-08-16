import { describe, it, expect } from 'vitest';
import { isValidStudentBirthday, registrationSchema } from '../registration';

// 測試一律傳入固定的今天，不依賴真實時間，
// 否則這些測試會隨著日子經過自己壞掉。
const TODAY = new Date('2026-08-16');

describe('isValidStudentBirthday', () => {
  it('接受 10 歲的孩子', () => {
    expect(isValidStudentBirthday('2016-08-16', TODAY)).toBe(true);
  });

  it('接受剛滿 5 歲的孩子', () => {
    expect(isValidStudentBirthday('2021-08-16', TODAY)).toBe(true);
  });

  it('拒絕未滿 5 歲的孩子', () => {
    expect(isValidStudentBirthday('2022-08-17', TODAY)).toBe(false);
  });

  it('拒絕超過 20 歲', () => {
    expect(isValidStudentBirthday('2005-08-15', TODAY)).toBe(false);
  });

  it('拒絕未來的日期', () => {
    expect(isValidStudentBirthday('2027-01-01', TODAY)).toBe(false);
  });

  it('拒絕格式錯誤的日期', () => {
    expect(isValidStudentBirthday('不是日期', TODAY)).toBe(false);
  });
});

describe('registrationSchema', () => {
  const validInput = {
    student_name: '林小明',
    student_gender: 'male' as const,
    student_birthday: '2016-05-20',
    school_level: 'elementary' as const,
    school_id: '11111111-1111-1111-1111-111111111111',
    school_name_raw: '',
    grade: 'E4',
    class_name: '忠班',
    parent_name: '林大明',
    relation: 'father' as const,
    contact_phone: '0912345678',
  };

  it('接受完整正確的報名資料', () => {
    expect(registrationSchema.safeParse(validInput).success).toBe(true);
  });

  it('班級留空仍然通過（班級是選填）', () => {
    const result = registrationSchema.safeParse({ ...validInput, class_name: '' });
    expect(result.success).toBe(true);
  });

  it('拒絕只有一個字的學生姓名', () => {
    const result = registrationSchema.safeParse({ ...validInput, student_name: '林' });
    expect(result.success).toBe(false);
  });

  it('拒絕格式錯誤的聯絡電話', () => {
    const result = registrationSchema.safeParse({ ...validInput, contact_phone: '123' });
    expect(result.success).toBe(false);
  });

  it('拒絕年級與學校級別不相符的組合', () => {
    // 選了國小卻送出國中的年級代碼
    const result = registrationSchema.safeParse({ ...validInput, grade: 'J1' });
    expect(result.success).toBe(false);
  });

  it('學校代碼與自由文字校名同時留空時拒絕', () => {
    const result = registrationSchema.safeParse({
      ...validInput,
      school_id: '',
      school_name_raw: '',
    });
    expect(result.success).toBe(false);
  });

  it('沒選到名錄學校但填了自由文字校名時通過', () => {
    const result = registrationSchema.safeParse({
      ...validInput,
      school_id: '',
      school_name_raw: '某某實驗教育機構',
    });
    expect(result.success).toBe(true);
  });

  it('錯誤訊息是繁體中文', () => {
    const result = registrationSchema.safeParse({ ...validInput, student_name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/[一-鿿]/);
    }
  });
});
