import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSchools, SEARCH_LIMIT } from '../schools';

const builder = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  ilike: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
};

// 讓每個方法都回傳 builder 自己，模擬 Supabase 的鏈式呼叫
for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
  builder[key].mockReturnValue(builder);
}

vi.mock('../supabase', () => ({
  supabase: { from: () => builder },
}));

describe('searchSchools', () => {
  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockClear();
      builder[key].mockReturnValue(builder);
    }
    builder.limit.mockResolvedValue({ data: [], error: null });
  });

  it('依級別篩選', async () => {
    await searchSchools({ level: 'junior', keyword: '中正', cities: [] });
    expect(builder.eq).toHaveBeenCalledWith('level', 'junior');
  });

  it('有指定縣市時加上縣市篩選', async () => {
    await searchSchools({
      level: 'elementary',
      keyword: '中正',
      cities: ['新北市', '臺北市'],
    });
    expect(builder.in).toHaveBeenCalledWith('city', ['新北市', '臺北市']);
  });

  it('縣市留空時不加縣市篩選，等於搜尋全國', async () => {
    await searchSchools({ level: 'elementary', keyword: '中正', cities: [] });
    expect(builder.in).not.toHaveBeenCalled();
  });

  it('關鍵字以模糊比對搜尋校名', async () => {
    await searchSchools({ level: 'elementary', keyword: '中正', cities: [] });
    expect(builder.ilike).toHaveBeenCalledWith('name', '%中正%');
  });

  it('關鍵字留空時不加校名條件，讓使用者可以先瀏覽', async () => {
    await searchSchools({ level: 'elementary', keyword: '', cities: [] });
    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it('最多回傳 20 筆', async () => {
    await searchSchools({ level: 'elementary', keyword: '中', cities: [] });
    expect(builder.limit).toHaveBeenCalledWith(SEARCH_LIMIT);
  });

  it('查詢出錯時回傳空陣列，不讓整個表單壞掉', async () => {
    builder.limit.mockResolvedValue({ data: null, error: { message: '壞了' } });
    const result = await searchSchools({
      level: 'elementary',
      keyword: '中',
      cities: [],
    });
    expect(result).toEqual([]);
  });
});
