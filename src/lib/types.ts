export type SchoolLevel = 'elementary' | 'junior' | 'senior';
export type RegistrationStatus = 'pending' | 'contacted' | 'enrolled' | 'cancelled';
export type Relation = 'father' | 'mother' | 'grandparent' | 'other';
export type Gender = 'male' | 'female';
export type UserRole = 'parent' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  created_at: string;
}

export interface School {
  id: string;
  code: string;
  name: string;
  level: SchoolLevel;
  city: string;
  address: string | null;
  phone: string | null;
}

export interface Registration {
  id: string;
  parent_id: string;
  student_name: string;
  student_gender: Gender;
  student_birthday: string;
  school_id: string | null;
  school_name_raw: string | null;
  grade: string;
  class_name: string | null;
  parent_name: string;
  relation: Relation;
  contact_phone: string;
  status: RegistrationStatus;
  created_at: string;
  updated_at: string;
}

/**
 * 內部備註，對應獨立的 registration_notes 表（只有管理員讀得到，
 * 見 supabase/migrations/20260817100000_split_admin_note_to_registration_notes.sql）。
 */
export interface RegistrationNote {
  registration_id: string;
  note: string | null;
  updated_at: string;
}

/**
 * 報名資料附帶學校名稱，對應資料庫的 registrations_with_school 檢視表。
 * 學校欄位是左連接來的，所以「找不到我的學校」那類報名這三個欄位會是 null，
 * 顯示時要退回 school_name_raw。
 *
 * 這個型別不含 admin_note —— 它不是這張檢視表本身的欄位（已經拆到
 * registration_notes、只開放 is_admin() 的列級權限，家長端完全查不到）。
 * 家長端（getRegistration／listMyRegistrations）讀到的物件天生就沒有
 * 這個鍵，型別上不宣告它，`as RegistrationWithSchool` 這個轉型才是誠實
 * 的、不會讓編譯器放行一個執行期根本不存在的欄位。
 */
export interface RegistrationWithSchool extends Registration {
  school_name: string | null;
  school_city: string | null;
  school_level: SchoolLevel | null;
}

/**
 * 孩子。這張表存的是「現在」的狀況 —— 年級每年會變、學校會轉。
 * 報名紀錄上的年級與學校是各自的快照，不要拿這裡的值去顯示歷史報名。
 */
export interface Student {
  id: string;
  parent_id: string;
  name: string;
  gender: Gender;
  birthday: string;
  school_id: string | null;
  school_name_raw: string | null;
  grade: string;
  class_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 孩子附帶學校名稱，對應 students_with_school 檢視表。
 * 學校欄位是左連接來的，「找不到我的學校」那類孩子這三欄會是 null，
 * 顯示時要退回 school_name_raw。
 */
export interface StudentWithSchool extends Student {
  school_name: string | null;
  school_city: string | null;
  school_level: SchoolLevel | null;
}

/**
 * 管理員後台專用的延伸型別：合併過內部備註的報名列。只有
 * adminRegistrations.ts 的 listRegistrations／listAllForExport 會產出
 * 這個型別，家長端一律用 RegistrationWithSchool（不含 admin_note）。
 *
 * admin_note 的三種值意義不同：
 * - string：確實有備註內容
 * - null：查詢成功、確認這筆報名沒有備註
 * - undefined：這一批備註讀取失敗（見 20260817100000 遷移後 attachNotes()
 *   的分批查詢），不是「查無備註」。RegistrationDetail 必須用這個訊號
 *   停用備註欄與儲存按鈕，不能讓管理員在不知情的狀態下把真正的備註
 *   存成空字串覆蓋掉。
 */
export interface AdminRegistrationRow extends RegistrationWithSchool {
  admin_note: string | null | undefined;
}

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  elementary: '國小',
  junior: '國中',
  senior: '高中職',
};

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: '待審核',
  contacted: '已聯絡',
  enrolled: '已錄取',
  cancelled: '已取消',
};

export const RELATION_LABELS: Record<Relation, string> = {
  father: '父親',
  mother: '母親',
  grandparent: '祖父母',
  other: '其他',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
};

/** 老莫的主要招生範圍，選擇器與後台篩選都以此為預設 */
export const DEFAULT_CITIES = ['新北市', '臺北市'];

const CHINESE_NUMERALS = ['一', '二', '三', '四', '五', '六'];

/**
 * 年級代碼刻意用級別字首加數字（E1、J1、S1），不讓三個級別的
 * 「一年級」共用同一個值，日後統計時才分得出是國小一年級還是國中一年級。
 */
export function getGradeOptions(level: SchoolLevel): { value: string; label: string }[] {
  const config: Record<SchoolLevel, { prefix: string; count: number }> = {
    elementary: { prefix: 'E', count: 6 },
    junior: { prefix: 'J', count: 3 },
    senior: { prefix: 'S', count: 3 },
  };

  const { prefix, count } = config[level];
  return Array.from({ length: count }, (_, index) => ({
    value: `${prefix}${index + 1}`,
    label: `${CHINESE_NUMERALS[index]}年級`,
  }));
}

/** 把年級代碼轉回可讀文字，例如 E3 → 國小三年級 */
export function formatGrade(grade: string): string {
  const levelMap: Record<string, string> = { E: '國小', J: '國中', S: '高中職' };
  const level = levelMap[grade[0]];
  const index = Number(grade.slice(1)) - 1;
  if (!level || Number.isNaN(index) || index < 0 || index >= CHINESE_NUMERALS.length) {
    return grade;
  }
  return `${level}${CHINESE_NUMERALS[index]}年級`;
}

const GRADE_RANK_CONFIG: Record<string, { offset: number; max: number }> = {
  E: { offset: 0, max: 6 },
  J: { offset: 6, max: 3 },
  S: { offset: 9, max: 3 },
};

/**
 * 年級代碼轉排序值：E1–E6 → 1–6、J1–J3 → 7–9、S1–S3 → 10–12。
 *
 * 比賽的參賽年級是一個區間，而年級代碼本身沒有順序 —— 直接比字串會得出
 * 'E4' < 'J1' 這種碰巧正確的結果，換個字首就崩了。
 *
 * 這份實作必須與資料庫的 grade_rank() 完全一致（見
 * supabase/migrations/20260818100000_create_students.sql）。資料庫那份是
 * 權威，這份只是為了讓前端不必等一次往返就能標出不符年級的孩子。
 *
 * 無法識別的代碼回 null 而不是丟例外：呼叫端拿到的是舊資料時，
 * 應該把那個孩子標成不可選，而不是讓整個畫面掛掉。
 */
export function gradeRank(grade: string): number | null {
  // 用正規表示式而不是 Number() 判斷：Number(' 1') 是 1，
  // 會讓 'E 1' 這種帶空白的代碼矇混過關
  const matched = /^([EJS])([1-9])$/.exec(grade);
  if (!matched) return null;

  const config = GRADE_RANK_CONFIG[matched[1]];
  const value = Number(matched[2]);
  if (value > config.max) return null;

  return config.offset + value;
}
