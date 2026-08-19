import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listMyStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../students';

const builder = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
};

for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
  builder[key].mockReturnValue(builder);
}

const from = vi.fn((_table: string) => builder);
const getSession = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    from: (t: string) => from(t),
    auth: { getSession: () => getSession() },
  },
}));

beforeEach(() => {
  from.mockClear();
  getSession.mockClear().mockResolvedValue({
    data: { session: { user: { id: 'parent-1' } } },
  });
  for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
    builder[key].mockClear();
    builder[key].mockReturnValue(builder);
  }
});

describe('listMyStudents', () => {
  it('讀取走檢視表，帶著學校名稱', async () => {
    builder.order.mockResolvedValue({ data: [], error: null });
    await listMyStudents();
    expect(from).toHaveBeenCalledWith('students_with_school');
  });

  /*
    列級權限有一條「管理員可讀全部孩子」，只靠權限過濾的話，管理員自己
    要報名時看到的會是全部家長的孩子。這個條件不是為了安全，是為了
    「我的孩子」名副其實。
  */
  it('只回目前登入這位的孩子', async () => {
    builder.order.mockResolvedValue({ data: [], error: null });
    await listMyStudents();
    expect(builder.eq).toHaveBeenCalledWith('parent_id', 'parent-1');
  });

  it('還沒登入就回空陣列，不去查資料庫', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await listMyStudents()).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('查詢出錯時回空陣列，不讓整個頁面壞掉', async () => {
    builder.order.mockResolvedValue({ data: null, error: { message: '壞了' } });
    expect(await listMyStudents()).toEqual([]);
  });
});

describe('createStudent', () => {
  const input = {
    parent_id: 'parent-1',
    name: '林小明',
    gender: 'male' as const,
    birthday: '2016-05-01',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E4',
    class_name: '忠班',
  };

  it('寫入走原表，不走檢視表', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'new-1' }], error: null });
    await createStudent(input);
    expect(from).toHaveBeenCalledWith('students');
  });

  it('成功時回傳新孩子的代碼', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'new-1' }], error: null });
    expect(await createStudent(input)).toEqual({ id: 'new-1', error: null });
  });

  it('失敗時回傳錯誤訊息，不回傳代碼', async () => {
    builder.select.mockResolvedValue({ data: null, error: { message: '壞了' } });
    const result = await createStudent(input);
    expect(result.id).toBeNull();
    expect(result.error).toBe('新增失敗，請稍後再試');
  });
});

describe('updateStudent', () => {
  const input = {
    name: '林小明',
    gender: 'male' as const,
    birthday: '2016-05-01',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E5',
    class_name: '孝班',
  };

  it('被列級權限擋下時回傳錯誤', async () => {
    /*
      列級權限擋下寫入時 PostgREST 回傳 204、error 是 null。
      只看 error 會誤判成功，一定要看 .select() 讀回的列數。
    */
    builder.select.mockResolvedValue({ data: [], error: null });
    const result = await updateStudent('student-1', input);
    expect(result.error).toBe('修改失敗，請重新登入後再試');
  });

  it('確實改到一列才算成功', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'student-1' }], error: null });
    expect(await updateStudent('student-1', input)).toEqual({ error: null });
  });
});

describe('deleteStudent', () => {
  it('孩子還有報名紀錄時，翻成看得懂的訊息', async () => {
    /*
      registrations.student_id 是 ON DELETE RESTRICT，資料庫會丟外鍵
      違規（代碼 23503）。直接把原始訊息丟給家長看是最差的作法。
    */
    builder.select.mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint' },
    });
    const result = await deleteStudent('student-1');
    expect(result.error).toBe('這個孩子已有報名紀錄，如需更正請聯繫我們');
  });

  it('其他錯誤用一般訊息', async () => {
    builder.select.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    });
    expect(await deleteStudent('student-1')).toEqual({
      error: '刪除失敗，請稍後再試',
    });
  });

  it('刪到 0 列代表不是自己的孩子', async () => {
    builder.select.mockResolvedValue({ data: [], error: null });
    expect(await deleteStudent('student-1')).toEqual({
      error: '刪除失敗，請重新登入後再試',
    });
  });

  it('刪到 1 列才算成功', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'student-1' }], error: null });
    expect(await deleteStudent('student-1')).toEqual({ error: null });
  });
});
