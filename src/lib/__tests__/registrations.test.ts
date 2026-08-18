import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRegistration,
  deleteRegistration,
  getRegistration,
  listMyRegistrations,
  updateRegistration,
  updateRegistrationStatus,
} from '../registrations';

const registrationsBuilder = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  maybeSingle: vi.fn(),
};

const viewBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  maybeSingle: vi.fn(),
};

const notesBuilder = {
  upsert: vi.fn(),
};

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'registrations') return registrationsBuilder;
      if (table === 'registration_notes') return notesBuilder;
      return viewBuilder;
    },
  },
}));

function resetBuilder<T extends Record<string, ReturnType<typeof vi.fn>>>(
  builder: T
) {
  for (const key of Object.keys(builder) as (keyof T)[]) {
    builder[key].mockReset();
    builder[key].mockReturnValue(builder);
  }
}

describe('registrations.ts', () => {
  beforeEach(() => {
    resetBuilder(registrationsBuilder);
    resetBuilder(viewBuilder);
    resetBuilder(notesBuilder);
  });

  const input = {
    student_name: '林小明',
    student_gender: 'male' as const,
    student_birthday: '2016-05-20',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E4',
    class_name: null,
    parent_name: '林大明',
    relation: 'father' as const,
    contact_phone: '0912345678',
  };

  describe('createRegistration', () => {
    it('新增成功時不回傳錯誤', async () => {
      registrationsBuilder.insert.mockResolvedValue({ error: null });
      const result = await createRegistration({ ...input, parent_id: 'parent-1', student_id: 'student-1' });
      expect(result).toEqual({ error: null });
    });

    it('資料庫回錯時回傳中文錯誤訊息', async () => {
      registrationsBuilder.insert.mockResolvedValue({
        error: { message: '壞了' },
      });
      const result = await createRegistration({ ...input, parent_id: 'parent-1', student_id: 'student-1' });
      expect(result.error).toBe('送出失敗，請稍後再試');
    });
  });

  describe('updateRegistration', () => {
    it('修改成功（回傳列數大於 0）時不回傳錯誤', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      const result = await updateRegistration('reg-1', input);
      expect(result).toEqual({ error: null });
    });

    it('資料庫回傳明確錯誤時回傳錯誤訊息', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: null,
        error: { message: '壞了' },
      });
      const result = await updateRegistration('reg-1', input);
      expect(result.error).not.toBeNull();
    });

    // 核心修正：列級權限擋下寫入時，PostgREST 回傳 204、error 是 null，
    // 比對到 0 筆可見列。若只看 error 是否為 null 會被誤判成功。
    it('列級權限擋下（回傳 0 筆、error 為 null）時仍回傳錯誤，不能被誤判成功', async () => {
      registrationsBuilder.select.mockResolvedValue({ data: [], error: null });
      const result = await updateRegistration('reg-1', input);
      expect(result.error).not.toBeNull();
      expect(result.error).toContain('已進入處理流程');
    });

    it('呼叫時帶上 .select() 以便讀回實際受影響的列數', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      await updateRegistration('reg-1', input);
      expect(registrationsBuilder.select).toHaveBeenCalled();
    });
  });

  describe('deleteRegistration', () => {
    it('撤回成功（回傳列數大於 0）時不回傳錯誤', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      const result = await deleteRegistration('reg-1');
      expect(result).toEqual({ error: null });
    });

    it('資料庫回傳明確錯誤時回傳錯誤訊息', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: null,
        error: { message: '壞了' },
      });
      const result = await deleteRegistration('reg-1');
      expect(result.error).not.toBeNull();
    });

    // 這是本次修正最重要的一條測試：對照專案自己在
    // scripts/verify-rls.ts 實測過的真實失敗形狀 —— 非待審核的報名，
    // 家長端撤回被列級權限擋下時，PostgREST 回傳 { data: [], error: null }，
    // 呼叫端仍必須拿到錯誤，卡片不能悄悄從畫面消失。
    it('列級權限擋下（回傳 0 筆、error 為 null）時仍回傳錯誤，不能被誤判成功', async () => {
      registrationsBuilder.select.mockResolvedValue({ data: [], error: null });
      const result = await deleteRegistration('reg-1');
      expect(result.error).not.toBeNull();
      expect(result.error).toContain('已進入處理流程');
    });

    it('呼叫時帶上 .select() 以便讀回實際受影響的列數', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      await deleteRegistration('reg-1');
      expect(registrationsBuilder.select).toHaveBeenCalled();
    });
  });

  describe('getRegistration', () => {
    it('查得到時回傳該筆資料', async () => {
      const row = { id: 'reg-1' };
      viewBuilder.maybeSingle.mockResolvedValue({ data: row, error: null });
      const result = await getRegistration('reg-1');
      expect(result).toEqual(row);
    });

    it('查無或出錯時回傳 null', async () => {
      viewBuilder.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: '壞了' },
      });
      const result = await getRegistration('reg-1');
      expect(result).toBeNull();
    });
  });

  describe('listMyRegistrations', () => {
    it('查詢成功時回傳列表', async () => {
      const rows = [{ id: 'reg-1' }, { id: 'reg-2' }];
      viewBuilder.order.mockResolvedValue({ data: rows, error: null });
      const result = await listMyRegistrations();
      expect(result).toEqual(rows);
    });

    it('查詢出錯時回傳空陣列', async () => {
      viewBuilder.order.mockResolvedValue({
        data: null,
        error: { message: '壞了' },
      });
      const result = await listMyRegistrations();
      expect(result).toEqual([]);
    });
  });

  describe('updateRegistrationStatus', () => {
    it('狀態寫入 registrations、備註寫入 registration_notes', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      notesBuilder.upsert.mockResolvedValue({ error: null });

      const result = await updateRegistrationStatus('reg-1', 'contacted', '已致電');

      expect(registrationsBuilder.update).toHaveBeenCalledWith({ status: 'contacted' });
      expect(notesBuilder.upsert).toHaveBeenCalledWith({
        registration_id: 'reg-1',
        note: '已致電',
      });
      expect(result).toEqual({ error: null });
    });

    it('備註留白時寫入 null，不是空字串', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      notesBuilder.upsert.mockResolvedValue({ error: null });

      await updateRegistrationStatus('reg-1', 'contacted', '');

      expect(notesBuilder.upsert).toHaveBeenCalledWith({
        registration_id: 'reg-1',
        note: null,
      });
    });

    it('狀態更新被列級權限擋下（0 筆、error 為 null）時回傳錯誤，且不再寫備註', async () => {
      registrationsBuilder.select.mockResolvedValue({ data: [], error: null });

      const result = await updateRegistrationStatus('reg-1', 'contacted', '已致電');

      expect(result.error).not.toBeNull();
      expect(notesBuilder.upsert).not.toHaveBeenCalled();
    });

    it('狀態更新失敗時回傳錯誤', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: null,
        error: { message: '壞了' },
      });
      const result = await updateRegistrationStatus('reg-1', 'contacted', '已致電');
      expect(result.error).not.toBeNull();
    });

    it('備註寫入失敗時回傳錯誤', async () => {
      registrationsBuilder.select.mockResolvedValue({
        data: [{ id: 'reg-1' }],
        error: null,
      });
      notesBuilder.upsert.mockResolvedValue({ error: { message: '壞了' } });

      const result = await updateRegistrationStatus('reg-1', 'contacted', '已致電');
      expect(result.error).not.toBeNull();
    });
  });
});
