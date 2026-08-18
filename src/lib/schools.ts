import { supabase } from './supabase';
import { normalizeSchoolKeyword } from './schoolKeyword';
import { PRIORITY_CITIES } from './types';
import type { School, SchoolLevel } from './types';

export const SEARCH_LIMIT = 20;

/**
 * 把雙北的學校排到前面，其餘維持資料庫回傳的校名順序。
 *
 * 排在前端而不是資料庫：PostgREST 的 order 只吃欄位，要在資料庫做就得
 * 為了排序在共用的學校名錄裡加一個「老莫的偏好」欄位，那是把這間補習班
 * 的招生範圍寫死進一份全國名錄裡。
 *
 * 這樣做的前提是命中筆數沒被 SEARCH_LIMIT 截掉，否則排序救不回已經被
 * 資料庫丟掉的那幾筆。實際查過名錄：最常見的校名「中正」「中山」全國
 * 命中數各是 18 與 16 筆（國小，級別最多的一級），都在 20 以內；家長
 * 一旦打了關鍵字就不會踩到上限。沒打關鍵字的瀏覽狀態會截，但那時本來
 * 就只是隨便列前幾筆給家長看，雙北優先仍然比校名排序有用。
 */
function sortByCityPriority(schools: School[]): School[] {
  const rank = (school: School) => {
    const index = PRIORITY_CITIES.indexOf(school.city);
    return index === -1 ? PRIORITY_CITIES.length : index;
  };
  // sort 在現行 JavaScript 保證穩定，同一個縣市內照樣是資料庫排好的校名順序
  return [...schools].sort((a, b) => rank(a) - rank(b));
}

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

  const keyword = normalizeSchoolKeyword(query.keyword);
  if (keyword !== '') {
    /*
      比對 search_name 而不是 name：那是正規化過的欄位（臺→台、去空白），
      配上家長輸入這端的 normalizeSchoolKeyword()，「台北市立光復國小」
      才找得到名錄裡的「市立光復國小」。

      ILIKE 前後都加萬用字元，讓家長打「中正」也找得到「市立中正國中」。
      這種查詢靠 schools_search_name_trgm_idx 三連字元索引才不會全表掃描。
    */
    request = request.ilike('search_name', `%${keyword}%`);
  }

  const { data, error } = await request.order('name').limit(SEARCH_LIMIT);

  if (error) {
    // 查不到學校不該讓整張報名表壞掉，回空陣列讓使用者可以改用
    // 「找不到我的學校」的出口繼續完成報名
    console.error('學校查詢失敗：', error.message);
    return [];
  }

  return sortByCityPriority((data ?? []) as School[]);
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
  const keyword = normalizeSchoolKeyword(query.keyword);
  // 家長還沒開始打字時跳出「其他級別有這些學校」毫無意義，也白費一次查詢
  if (keyword === '') return [];

  let request = supabase
    .from('schools')
    .select('id, code, name, level, city')
    .neq('level', query.level)
    .ilike('search_name', `%${keyword}%`);

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

  // 提示只有三筆，更要讓雙北那筆排得到前面
  return sortByCityPriority((data ?? []) as School[]);
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
