import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listRegistrations, EMPTY_FILTERS, PAGE_SIZE, getStats } from '../adminRegistrations';

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

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => (table === 'registrations' ? statsBuilder : builder),
  },
}));

describe('listRegistrations', () => {
  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockReset();
      builder[key].mockReturnValue(builder);
    }
    builder.range.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it('預設篩選雙北', async () => {
    await listRegistrations(EMPTY_FILTERS, 0);
    expect(builder.in).toHaveBeenCalledWith('school_city', ['新北市', '臺北市']);
  });

  it('縣市清空後不加縣市條件', async () => {
    await listRegistrations({ ...EMPTY_FILTERS, cities: [] }, 0);
    expect(builder.in).not.toHaveBeenCalledWith(
      'school_city',
      expect.anything()
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
