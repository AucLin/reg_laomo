import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listRegistrations,
  listAllForExport,
  EMPTY_FILTERS,
  PAGE_SIZE,
  getStats,
} from '../adminRegistrations';

const builder = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
};

// getStats 查詢的是 registrations 原表（不是 registrations_with_school 檢視表），
// 用另一個 builder 區分開來，不然它的 .eq()／.gte() 會跟 listRegistrations
// 那組互相干擾（同一個 mock 函式在兩邊被賦予不同的回傳型態）。
const statsBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
};

// 內部備註已拆到獨立的 registration_notes 表，attachNotes() 會另外查一次
// 這張表再合併回結果列，用第三個 builder 隔開，避免跟主查詢／統計查詢的
// mock 互相干擾。
const notesBuilder = {
  select: vi.fn(),
  in: vi.fn(),
};

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'registrations') return statsBuilder;
      if (table === 'registration_notes') return notesBuilder;
      return builder;
    },
  },
}));

describe('listRegistrations', () => {
  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockReset();
      builder[key].mockReturnValue(builder);
    }
    builder.range.mockResolvedValue({ data: [], count: 0, error: null });

    for (const key of Object.keys(notesBuilder) as (keyof typeof notesBuilder)[]) {
      notesBuilder[key].mockReset();
      notesBuilder[key].mockReturnValue(notesBuilder);
    }
    notesBuilder.in.mockResolvedValue({ data: [], error: null });
  });

  // 縣市篩選改用 .or() 而非 .in()：school_city 是 registrations_with_school
  // 左連接學校表帶出來的欄位，自由填寫校名（school_id 為 NULL）或學校已被
  // 停用（is_active = false，schools 的讀取政策擋下）時 school_city 會是
  // NULL。SQL 的 IN 對 NULL 求值為 NULL、視同不成立，該列會被整批濾掉 ——
  // 而那正是規格要求「待人工確認學校」要醒目標記的一批，最不該消失。
  // 用 OR 明確放行 school_city IS NULL，才能讓這批報名留在篩選結果裡。
  it('預設篩選雙北，且放行 school_city 為 NULL 的報名（找不到我的學校／學校已停用）', async () => {
    await listRegistrations(EMPTY_FILTERS, 0);
    expect(builder.or).toHaveBeenCalledWith(
      'school_city.in.("新北市","臺北市"),school_city.is.null'
    );
  });

  it('縣市篩選條件確實包含 is.null，不是只縮小成 IN 清單', async () => {
    await listRegistrations(EMPTY_FILTERS, 0);
    const cityCall = builder.or.mock.calls.find((call) =>
      String(call[0]).includes('school_city')
    );
    expect(cityCall?.[0]).toContain('school_city.is.null');
  });

  it('縣市清空後不加縣市條件', async () => {
    await listRegistrations({ ...EMPTY_FILTERS, cities: [] }, 0);
    expect(builder.or).not.toHaveBeenCalledWith(
      expect.stringContaining('school_city')
    );
  });

  it('指定狀態時加上狀態條件', async () => {
    await listRegistrations({ ...EMPTY_FILTERS, status: 'contacted' }, 0);
    expect(builder.eq).toHaveBeenCalledWith('status', 'contacted');
  });

  it('狀態留空時不加狀態條件', async () => {
    await listRegistrations(EMPTY_FILTERS, 0);
    expect(builder.eq).not.toHaveBeenCalledWith('status', expect.anything());
  });

  it('關鍵字同時比對學生姓名、家長姓名與電話', async () => {
    await listRegistrations({ ...EMPTY_FILTERS, keyword: '林' }, 0);
    expect(builder.or).toHaveBeenCalledWith(
      'student_name.ilike.%林%,parent_name.ilike.%林%,contact_phone.ilike.%林%'
    );
  });

  it('依送出時間新到舊排序', async () => {
    await listRegistrations(EMPTY_FILTERS, 0);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('第二頁取第 25 到 49 筆', async () => {
    await listRegistrations(EMPTY_FILTERS, 1);
    expect(builder.range).toHaveBeenCalledWith(PAGE_SIZE, PAGE_SIZE * 2 - 1);
  });

  it('查詢出錯時回傳空結果而非拋出例外', async () => {
    builder.range.mockResolvedValue({ data: null, count: null, error: { message: '壞了' } });
    const result = await listRegistrations(EMPTY_FILTERS, 0);
    expect(result).toEqual({ rows: [], total: 0 });
  });

  // 核心行為：admin_note 不是 registrations_with_school 檢視表本身的欄位
  // （已拆到 registration_notes，只給 is_admin() 讀），listRegistrations
  // 要另外查一次備註表、用 registration_id 合併回每一列。
  it('把 registration_notes 的備註依 registration_id 合併回每一列', async () => {
    builder.range.mockResolvedValue({
      data: [{ id: 'reg-1' }, { id: 'reg-2' }],
      count: 2,
      error: null,
    });
    notesBuilder.in.mockResolvedValue({
      data: [
        { registration_id: 'reg-1', note: '已致電，約好週末回撥' },
        { registration_id: 'reg-2', note: null },
      ],
      error: null,
    });

    const result = await listRegistrations(EMPTY_FILTERS, 0);

    expect(notesBuilder.in).toHaveBeenCalledWith('registration_id', ['reg-1', 'reg-2']);
    expect(result.rows).toEqual([
      expect.objectContaining({ id: 'reg-1', admin_note: '已致電，約好週末回撥' }),
      expect.objectContaining({ id: 'reg-2', admin_note: null }),
    ]);
  });

  it('查無備註的報名合併後 admin_note 是 null，不是 undefined', async () => {
    builder.range.mockResolvedValue({
      data: [{ id: 'reg-1' }],
      count: 1,
      error: null,
    });
    notesBuilder.in.mockResolvedValue({ data: [], error: null });

    const result = await listRegistrations(EMPTY_FILTERS, 0);
    expect(result.rows[0].admin_note).toBeNull();
  });

  it('備註查詢失敗時主要列表仍然回傳，admin_note 留 null', async () => {
    builder.range.mockResolvedValue({
      data: [{ id: 'reg-1' }],
      count: 1,
      error: null,
    });
    notesBuilder.in.mockResolvedValue({
      data: null,
      error: { message: '壞了' },
    });

    const result = await listRegistrations(EMPTY_FILTERS, 0);
    expect(result.rows).toEqual([expect.objectContaining({ id: 'reg-1', admin_note: null })]);
  });

  it('沒有任何列時不會多查一次備註表', async () => {
    builder.range.mockResolvedValue({ data: [], count: 0, error: null });
    await listRegistrations(EMPTY_FILTERS, 0);
    expect(notesBuilder.in).not.toHaveBeenCalled();
  });
});

describe('listAllForExport', () => {
  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockReset();
      builder[key].mockReturnValue(builder);
    }
    builder.order.mockResolvedValue({ data: [], error: null });

    for (const key of Object.keys(notesBuilder) as (keyof typeof notesBuilder)[]) {
      notesBuilder[key].mockReset();
      notesBuilder[key].mockReturnValue(notesBuilder);
    }
    notesBuilder.in.mockResolvedValue({ data: [], error: null });
  });

  it('匯出的每一列也合併了對應的內部備註', async () => {
    builder.order.mockResolvedValue({
      data: [{ id: 'reg-1' }],
      error: null,
    });
    notesBuilder.in.mockResolvedValue({
      data: [{ registration_id: 'reg-1', note: '已致電' }],
      error: null,
    });

    const result = await listAllForExport(EMPTY_FILTERS);

    expect(result).toEqual([expect.objectContaining({ id: 'reg-1', admin_note: '已致電' })]);
  });

  it('查詢出錯時回傳空陣列', async () => {
    builder.order.mockResolvedValue({ data: null, error: { message: '壞了' } });
    const result = await listAllForExport(EMPTY_FILTERS);
    expect(result).toEqual([]);
  });
});

describe('getStats', () => {
  beforeEach(() => {
    for (const key of Object.keys(statsBuilder) as (keyof typeof statsBuilder)[]) {
      statsBuilder[key].mockReset();
    }
    statsBuilder.select.mockReturnValue(statsBuilder);
  });

  it('四個計數各自呼叫正確的 .eq()／.gte() 條件', async () => {
    statsBuilder.eq.mockResolvedValue({ count: 1, error: null });
    statsBuilder.gte.mockResolvedValue({ count: 4, error: null });

    const result = await getStats();

    expect(statsBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(statsBuilder.eq).toHaveBeenCalledWith('status', 'contacted');
    expect(statsBuilder.eq).toHaveBeenCalledWith('status', 'enrolled');
    expect(statsBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(result).toEqual({ thisMonth: 4, pending: 1, contacted: 1, enrolled: 1 });
  });

  it('其中一個查詢失敗時仍回傳其餘可用值', async () => {
    statsBuilder.eq.mockImplementation((_field: string, status: string) =>
      status === 'contacted'
        ? Promise.resolve({ count: null, error: { message: '壞了' } })
        : Promise.resolve({ count: 3, error: null })
    );
    statsBuilder.gte.mockResolvedValue({ count: 7, error: null });

    const result = await getStats();

    expect(result).toEqual({ thisMonth: 7, pending: 3, contacted: 0, enrolled: 3 });
  });
});
