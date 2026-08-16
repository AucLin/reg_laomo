import { supabase } from './supabase';
import {
  DEFAULT_CITIES,
  type AdminRegistrationRow,
  type RegistrationStatus,
  type RegistrationWithSchool,
  type SchoolLevel,
} from './types';

export const PAGE_SIZE = 25;

/**
 * registration_notes 只用 registration_id 查詢，一次塞太多 id 進
 * .in() 會讓 PostgREST 的 GET 查詢字串超長。複審者對本專案實際端點
 * 做過唯讀實測：50～300 筆 id 都正常，500 筆開始 TypeError: fetch
 * failed，1000／2000 筆直接 Bad Request。200 留在安全邊界內、離
 * 500 這個實測失敗點還有一倍緩衝。
 */
const NOTES_BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

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
 *
 * id 數量可能超過安全邊界（見 NOTES_BATCH_SIZE 的註解），所以切成每批
 * 200 筆分開查詢、平行送出再合併。某一批失敗時只有那一批的列要降級，
 * 不能因為一批失敗就把其他批已經查成功的真實備註也一起丟掉；同時用
 * admin_note: undefined（不是 null）標記「這批沒讀到」，null 留給
 * 「確認查無備註」，讓下游（RegistrationDetail）分得出兩者的差異 ——
 * 前者不能讓管理員在不知情的狀態下存檔覆蓋，後者可以正常編輯。
 * notesFailed 則是「這次呼叫是否至少有一批失敗」的總旗標，給呼叫端
 * （目前是匯出）決定要不要在畫面上顯示警示，不能只留一行 console.error
 * 在主控台，管理員完全看不到。
 */
async function attachNotes(
  rows: RegistrationWithSchool[]
): Promise<{ rows: AdminRegistrationRow[]; notesFailed: boolean }> {
  if (rows.length === 0) return { rows: [], notesFailed: false };

  const idBatches = chunk(
    rows.map((row) => row.id),
    NOTES_BATCH_SIZE
  );

  const batchResults = await Promise.all(
    idBatches.map((ids) =>
      supabase.from('registration_notes').select('registration_id, note').in('registration_id', ids)
    )
  );

  const noteByRegistrationId = new Map<string, string | null>();
  const failedIds = new Set<string>();
  let notesFailed = false;

  batchResults.forEach(({ data, error }, index) => {
    if (error) {
      console.error('讀取內部備註失敗：', error.message);
      notesFailed = true;
      for (const id of idBatches[index]) failedIds.add(id);
      return;
    }
    for (const item of data ?? []) {
      noteByRegistrationId.set(item.registration_id as string, item.note as string | null);
    }
  });

  const mergedRows: AdminRegistrationRow[] = rows.map((row) => ({
    ...row,
    admin_note: failedIds.has(row.id)
      ? undefined
      : noteByRegistrationId.get(row.id) ?? null,
  }));

  return { rows: mergedRows, notesFailed };
}

export async function listRegistrations(
  filters: AdminFilters,
  page: number
): Promise<{ rows: AdminRegistrationRow[]; total: number; notesFailed: boolean }> {
  const query = applyFilters(buildBaseQuery(true), filters);

  const from = page * PAGE_SIZE;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error('讀取報名列表失敗：', error.message);
    return { rows: [], total: 0, notesFailed: false };
  }

  const { rows, notesFailed } = await attachNotes((data ?? []) as RegistrationWithSchool[]);
  return { rows, total: count ?? 0, notesFailed };
}

/** 匯出用：不分頁，取全部符合條件的資料 */
export async function listAllForExport(
  filters: AdminFilters
): Promise<{ rows: AdminRegistrationRow[]; notesFailed: boolean }> {
  const query = applyFilters(buildBaseQuery(false), filters);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('匯出查詢失敗：', error.message);
    return { rows: [], notesFailed: false };
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
