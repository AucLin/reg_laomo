import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchSchools,
  searchOtherLevels,
  SEARCH_LIMIT,
  OTHER_LEVEL_HINT_LIMIT,
} from '../schools';
import type { School } from '../types';

const builder = {
  select: vi.fn(),
  eq: vi.fn(),
  neq: vi.fn(),
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
    // 比對的是正規化過的 search_name，不是 name —— 家長打的字也會先過
    // normalizeSchoolKeyword()，兩端規則要一致才對得上
    expect(builder.ilike).toHaveBeenCalledWith('search_name', '%中正%');
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

/*
  教育部名錄只收獨立立案的學校。雙北登錄了 50 所私立高中，私立國小
  卻只有 11 所 —— 一貫制學校的國小部多半只以高中身分登錄一筆。
  家長在國小級別搜「康橋」什麼都沒有，會以為系統壞了，而不是去點
  「找不到我的學校」。這個查詢就是為了在那一刻告訴他實際情況。
*/
describe('searchOtherLevels', () => {
  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockClear();
      builder[key].mockReturnValue(builder);
    }
    builder.limit.mockResolvedValue({ data: [], error: null });
  });

  it('排除目前這個級別，只找其他級別', async () => {
    await searchOtherLevels({ level: 'elementary', keyword: '康橋', cities: [] });
    expect(builder.neq).toHaveBeenCalledWith('level', 'elementary');
  });

  it('沒有關鍵字時不查詢，直接回空陣列', async () => {
    // 家長還沒開始打字，跳出「其他級別有這些學校」毫無意義
    const result = await searchOtherLevels({
      level: 'elementary',
      keyword: '   ',
      cities: [],
    });
    expect(result).toEqual([]);
    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it('沿用家長設定的縣市範圍', async () => {
    // 縣市不一致的話，畫面會出現「你的搜尋範圍找不到，但別的縣市有」
    // 這種更難理解的提示
    await searchOtherLevels({
      level: 'elementary',
      keyword: '康橋',
      cities: ['新北市'],
    });
    expect(builder.in).toHaveBeenCalledWith('city', ['新北市']);
  });

  it('只取少量結果，這是提示不是搜尋結果', async () => {
    await searchOtherLevels({ level: 'elementary', keyword: '康橋', cities: [] });
    expect(builder.limit).toHaveBeenCalledWith(OTHER_LEVEL_HINT_LIMIT);
  });

  it('查詢出錯時回空陣列，不影響原本的報名流程', async () => {
    builder.limit.mockResolvedValue({ data: null, error: { message: '壞了' } });
    const result = await searchOtherLevels({
      level: 'elementary',
      keyword: '康橋',
      cities: [],
    });
    expect(result).toEqual([]);
  });
});

/*
  同樣命中關鍵字時雙北排前面。四個預設縣市裡實際來上課的孩子絕大多數在
  雙北，家長打「中正國小」跳出一整排同名學校，第一眼該看到他家那所。
*/
describe('雙北優先排序', () => {
  const school = (name: string, city: string): School => ({
    id: name,
    code: name,
    name,
    level: 'elementary',
    city,
  });

  beforeEach(() => {
    for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
      builder[key].mockClear();
      builder[key].mockReturnValue(builder);
    }
  });

  it('雙北的學校排到其他縣市前面', async () => {
    builder.limit.mockResolvedValue({
      data: [
        school('桃園中正國小', '桃園市'),
        school('臺北中正國小', '臺北市'),
        school('基隆中正國小', '基隆市'),
        school('新北中正國小', '新北市'),
      ],
      error: null,
    });

    const result = await searchSchools({
      level: 'elementary',
      keyword: '中正',
      cities: [],
    });

    expect(result.map((s) => s.name)).toEqual([
      '臺北中正國小',
      '新北中正國小',
      '桃園中正國小',
      '基隆中正國小',
    ]);
  });

  it('同一個縣市內維持資料庫排好的校名順序', async () => {
    builder.limit.mockResolvedValue({
      data: [
        school('中山國小', '臺北市'),
        school('中正國小', '臺北市'),
        school('文化國小', '臺北市'),
      ],
      error: null,
    });

    const result = await searchSchools({
      level: 'elementary',
      keyword: '中',
      cities: [],
    });

    expect(result.map((s) => s.name)).toEqual(['中山國小', '中正國小', '文化國小']);
  });

  it('非雙北的學校照樣列得出來，只是排在後面', async () => {
    // 這是排序不是篩選：桃園的孩子也報得了名
    builder.limit.mockResolvedValue({
      data: [school('桃園中正國小', '桃園市')],
      error: null,
    });

    const result = await searchSchools({
      level: 'elementary',
      keyword: '中正',
      cities: [],
    });

    expect(result.map((s) => s.name)).toEqual(['桃園中正國小']);
  });

  it('跨級別提示也雙北優先，只有三筆更要排對', async () => {
    builder.limit.mockResolvedValue({
      data: [school('桃園康橋高中', '桃園市'), school('康橋高中', '新北市')],
      error: null,
    });

    const result = await searchOtherLevels({
      level: 'elementary',
      keyword: '康橋',
      cities: [],
    });

    expect(result.map((s) => s.name)).toEqual(['康橋高中', '桃園康橋高中']);
  });
});
