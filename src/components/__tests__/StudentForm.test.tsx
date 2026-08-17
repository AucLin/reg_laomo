import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StudentForm, {
  EMPTY_STUDENT_FORM,
  parseStudentForm,
  studentToFormValue,
} from '../StudentForm';
import type { StudentWithSchool } from '../../lib/types';

vi.mock('../SchoolSelector', () => ({
  default: () => <div>學校選擇器</div>,
}));

describe('StudentForm', () => {
  it('顯示孩子的每一個資料欄位', () => {
    render(<StudentForm value={EMPTY_STUDENT_FORM} onChange={vi.fn()} />);

    expect(screen.getByLabelText('學生姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('生日')).toBeInTheDocument();
    expect(screen.getByLabelText('班級')).toBeInTheDocument();
    expect(screen.getByLabelText('年級')).toBeInTheDocument();
  });

  it('年級選項跟著學校級別走', () => {
    render(
      <StudentForm
        value={{ ...EMPTY_STUDENT_FORM, level: 'junior' }}
        onChange={vi.fn()}
      />
    );

    // 國中只有三個年級，加上「請選擇」共四個選項
    expect(screen.getByLabelText('年級').querySelectorAll('option')).toHaveLength(4);
  });

  /*
    注音、倉頡在選字前會持續觸發輸入事件。輸入框是受控的，組字期間若不把
    值往上傳，任何一次重新渲染都會把使用者正在打的字清空 —— 本專案曾經
    因為這個缺陷讓全站中文輸入壞掉。
  */
  it('中文組字期間就把值往上傳', () => {
    const onChange = vi.fn();
    render(<StudentForm value={EMPTY_STUDENT_FORM} onChange={onChange} />);

    const input = screen.getByLabelText('學生姓名');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄌㄧㄣˊ' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ㄌㄧㄣˊ' })
    );
  });
});

describe('parseStudentForm', () => {
  const 合法 = {
    ...EMPTY_STUDENT_FORM,
    name: '林小明',
    gender: 'male' as const,
    birthday: '2016-05-20',
    schoolId: 'school-1',
    grade: 'E4',
  };

  it('可空欄位的空字串要轉成 null', () => {
    const result = parseStudentForm(合法);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        school_name_raw: null,
        class_name: null,
        school_id: 'school-1',
      }),
    });
  });

  it('驗證失敗時回傳第一則錯誤訊息', () => {
    const result = parseStudentForm({ ...合法, birthday: '1990-01-01' });

    expect(result).toEqual({
      ok: false,
      message: '生日不合理，就讀學生年齡應介於 5 至 20 歲',
    });
  });
});

describe('studentToFormValue', () => {
  it('自由填寫校名的孩子（school_level 為 null）退回國小當預設', () => {
    const student = {
      id: 'student-1',
      parent_id: 'parent-1',
      name: '林小明',
      gender: 'male',
      birthday: '2016-05-20',
      school_id: null,
      school_name_raw: '某某實驗教育機構',
      grade: 'E4',
      class_name: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
      school_name: null,
      school_city: null,
      school_level: null,
    } satisfies StudentWithSchool;

    expect(studentToFormValue(student)).toEqual({
      name: '林小明',
      gender: 'male',
      birthday: '2016-05-20',
      level: 'elementary',
      schoolId: '',
      schoolNameRaw: '某某實驗教育機構',
      grade: 'E4',
      className: '',
    });
  });
});
