import { supabase } from './supabase';
import {
  DEFAULT_CITIES,
  type RegistrationStatus,
  type RegistrationWithSchool,
  type SchoolLevel,
} from './types';

export const PAGE_SIZE = 25;

export interface AdminFilters {
  level: SchoolLevel | '';
  /** 空陣列代表不限縣市 */
  cities: string[];
  grade: string;
  status: RegistrationStatus | '';
  keyword: string;
}

export const EMPTY_FILTERS: AdminFilters = {
  level: '',
  cities: DEFAULT_CITIES,
  grade: '',
  status: '',
  keyword: '',
};

/**
 * 讀取走檢視表。學校欄位是左連接平鋪上來的，所以 school_city 可以像一般
 * 欄位那樣篩選，而「找不到我的學校」那批（school_id 為 NULL）也還在資料集裡 ——
 * 用巢狀的 schools!inner 內連接會把它們整批濾掉，那正是最需要人工確認的一批。
 */
const VIEW = 'registrations_with_school';

/**
 * 把縣市清單組成 PostgREST 的 or() 篩選字串，同時放行 school_city IS NULL。
 *
 * school_city 是左連接學校表帶出來的欄位：自由填寫校名（school_id 為
 * NULL，即「找不到我的學校」）或學校已被停用（schools 的讀取政策擋下
 * is_active = false 的列）時，這個欄位都會是 NULL。若只用
 * `.in('school_city', cities)`，SQL 的 IN 對 NULL 求值永遠是 NULL、視同
 * 不成立，這些報名會被整批濾掉 —— 而它們正是規格要求「待人工確認學校」
 * 要醒目標記的一批，最不該從清單裡消失。
 *
 * 值一律用雙引號包住（PostgREST or() 語法要求），並把值本身可能出現的
 * 雙引號跳脫掉，避免值裡剛好帶雙引號時把篩選字串弄壞。
 */
function cityOrNullFilter(cities: string[]): string {
  const quoted = cities
    .map((city) => `"${city.replace(/"/g, '\\"')}"`)
    .join(',');
  return `school_city.in.(${quoted}),school_city.is.null`;
}

/** 把篩選條件套到查詢上。列表與匯出共用，確保匯出的就是畫面上看到的。 */
function applyFilters(request: ReturnType<typeof buildBaseQuery>, filters: AdminFilters) {
  let query = request;

  if (filters.cities.length > 0) {
    query = query.or(cityOrNullFilter(filters.cities));
  }
  if (filters.level !== '') {
    query = query.eq('school_level', filters.level);
  }
  if (filters.grade !== '') {
    query = query.eq('grade', filters.grade);
  }
  if (filters.status !== '') {
    query = query.eq('status', filters.status);
  }

  const keyword = filters.keyword.trim();
  if (keyword !== '') {
    query = query.or(
      `student_name.ilike.%${keyword}%,parent_name.ilike.%${keyword}%,contact_phone.ilike.%${keyword}%`
    );
  }

  return query;
}

function buildBaseQuery(withCount: boolean) {
  return supabase
    .from(VIEW)
    .select('*', withCount ? { count: 'exact' } : undefined);
}

/**
 * 內部備註已經拆到獨立的 registration_notes 表（只開放 is_admin() 的
 * 列級權限，見 20260817100000 遷移），registrations_with_school 檢視表
 * 本身不含這個欄位。管理員後台的列表與匯出都需要顯示備註，這裡額外
 * 查一次 registration_notes、用 registration_id 合併回每一列 ——
 * 不是在檢視表裡把兩張表 LEFT JOIN 起來，是刻意的：這樣家長端
 * （registrations.ts 的 getRegistration／listMyRegistrations）沿用同一張
 * registrations_with_school 檢視表時，天生連 admin_note 這個鍵都不會
 * 出現在查詢結果裡，不必依賴「前端不要印出來」這種擋不住自己構造請求
 * 的防線。
 */
async function attachNotes(
  rows: RegistrationWithSchool[]
): Promise<RegistrationWithSchool[]> {
  if (rows.length === 0) return rows;

  const { data, error } = await supabase
    .from('registration_notes')
    .select('registration_id, note')
    .in(
      'registration_id',
      rows.map((row) => row.id)
    );

  if (error) {
    console.error('讀取內部備註失敗：', error.message);
    // 備註查詢失敗不該讓整份報名列表跟著消失 —— 主要資料仍然可用，
    // 只是這一輪備註留白，比整頁空白對行政人員有用得多。
    return rows.map((row) => ({ ...row, admin_note: null }));
  }

  const noteByRegistrationId = new Map(
    (data ?? []).map((item) => [item.registration_id as string, item.note as string | null])
  );
  return rows.map((row) => ({
    ...row,
    admin_note: noteByRegistrationId.get(row.id) ?? null,
  }));
}

export async function listRegistrations(
  filters: AdminFilters,
  page: number
): Promise<{ rows: RegistrationWithSchool[]; total: number }> {
  const query = applyFilters(buildBaseQuery(true), filters);

  const from = page * PAGE_SIZE;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error('讀取報名列表失敗：', error.message);
    return { rows: [], total: 0 };
  }

  const rows = await attachNotes((data ?? []) as RegistrationWithSchool[]);
  return { rows, total: count ?? 0 };
}

/** 匯出用：不分頁，取全部符合條件的資料 */
export async function listAllForExport(
  filters: AdminFilters
): Promise<RegistrationWithSchool[]> {
  const query = applyFilters(buildBaseQuery(false), filters);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('匯出查詢失敗：', error.message);
    return [];
  }
  return attachNotes((data ?? []) as RegistrationWithSchool[]);
}

/** 統計卡用的各狀態筆數與本月報名數 */
export async function getStats(): Promise<{
  thisMonth: number;
  pending: number;
  contacted: number;
  enrolled: number;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  /**
   * head: true 只取筆數不取資料列，統計卡不需要內容。
   * 這裡直接寫成兩個具體的查詢函式，不做通用包裝 —— 通用包裝要標註
   * Supabase 查詢建構器的中間型別，寫起來繞且容易被版本變動弄壞。
   */
  async function countByStatus(status: RegistrationStatus): Promise<number> {
    const { count, error } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    if (error) {
      console.error('統計查詢失敗：', error.message);
      return 0;
    }
    return count ?? 0;
  }

  async function countThisMonth(): Promise<number> {
    const { count, error } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());
    if (error) {
      console.error('統計查詢失敗：', error.message);
      return 0;
    }
    return count ?? 0;
  }

  const [thisMonth, pending, contacted, enrolled] = await Promise.all([
    countThisMonth(),
    countByStatus('pending'),
    countByStatus('contacted'),
    countByStatus('enrolled'),
  ]);

  return { thisMonth, pending, contacted, enrolled };
}
