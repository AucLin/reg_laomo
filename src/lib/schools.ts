import { supabase } from './supabase';
import type { School, SchoolLevel } from './types';

export const SEARCH_LIMIT = 20;

export interface SchoolQuery {
  level: SchoolLevel;
  keyword: string;
  /** 空陣列代表不限縣市（搜尋全國） */
  cities: string[];
}

export async function searchSchools(query: SchoolQuery): Promise<School[]> {
  let request = supabase
    .from('schools')
    .select('id, code, name, level, city, address, phone')
    .eq('level', query.level);

  if (query.cities.length > 0) {
    request = request.in('city', query.cities);
  }

  const keyword = query.keyword.trim();
  if (keyword !== '') {
    // ILIKE 前後都加萬用字元，讓家長打「中正」也找得到「臺北市立中正國中」。
    // 這種查詢靠 schools_name_trgm_idx 三連字元索引才不會全表掃描。
    request = request.ilike('name', `%${keyword}%`);
  }

  const { data, error } = await request.order('name').limit(SEARCH_LIMIT);

  if (error) {
    // 查不到學校不該讓整張報名表壞掉，回空陣列讓使用者可以改用
    // 「找不到我的學校」的出口繼續完成報名
    console.error('學校查詢失敗：', error.message);
    return [];
  }

  return (data ?? []) as School[];
}

/**
 * 依代碼取回單一學校。編輯既有報名時要把先前選的學校顯示出來，
 * 這時手上只有 school_id，沒有校名。
 */
export async function getSchoolById(id: string): Promise<School | null> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, code, name, level, city, address, phone')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('讀取學校失敗：', error.message);
    return null;
  }
  return data as School | null;
}
