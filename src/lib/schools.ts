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
    .select('id, code, name, level, city')
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

/** 跨級別提示只是給家長一個線索，不是搜尋結果，取少量就好 */
export const OTHER_LEVEL_HINT_LIMIT = 3;

/**
 * 在「其他級別」裡找同名學校。
 *
 * 教育部名錄只收獨立立案的學校，雙北多所私立完全中學是幼兒園到高中
 * 一貫制，名錄卻只登錄高中那一筆 —— 雙北有 50 所私立高中，私立國小
 * 卻只有 11 所。家長在國小級別搜「康橋」什麼都沒有，第一反應是系統
 * 壞了，而不是去點「找不到我的學校」。
 *
 * 這個查詢就是為了在那一刻告訴他：這所學校在名錄裡登錄成高中，你要找
 * 的國小部要走自由填寫。
 */
export async function searchOtherLevels(query: SchoolQuery): Promise<School[]> {
  const keyword = query.keyword.trim();
  // 家長還沒開始打字時跳出「其他級別有這些學校」毫無意義，也白費一次查詢
  if (keyword === '') return [];

  let request = supabase
    .from('schools')
    .select('id, code, name, level, city')
    .neq('level', query.level)
    .ilike('name', `%${keyword}%`);

  // 沿用家長設定的縣市範圍。範圍不一致的話，畫面會出現「你的搜尋範圍
  // 找不到，但別的縣市有」這種更難理解的提示。
  if (query.cities.length > 0) {
    request = request.in('city', query.cities);
  }

  const { data, error } = await request.order('name').limit(OTHER_LEVEL_HINT_LIMIT);

  if (error) {
    // 這只是輔助提示，查不到就安靜跳過，不能影響原本的報名流程
    console.error('跨級別學校查詢失敗：', error.message);
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
    .select('id, code, name, level, city')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('讀取學校失敗：', error.message);
    return null;
  }
  return data as School | null;
}
