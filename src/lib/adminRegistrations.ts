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

/** 把篩選條件套到查詢上。列表與匯出共用，確保匯出的就是畫面上看到的。 */
function applyFilters(request: ReturnType<typeof buildBaseQuery>, filters: AdminFilters) {
  let query = request;

  if (filters.cities.length > 0) {
    query = query.in('school_city', filters.cities);
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

  return { rows: (data ?? []) as RegistrationWithSchool[], total: count ?? 0 };
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
  return (data ?? []) as RegistrationWithSchool[];
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
