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
 * admin_note 不是這張檢視表本身的欄位（它已經拆到 registration_notes、
 * 只開放 is_admin() 的列級權限，家長端完全查不到）。這裡把它列在型別上
 * 是給「管理員後台合併過備註的列」用的 —— adminRegistrations.ts 的
 * listRegistrations／listAllForExport 會額外查一次 registration_notes
 * 再合併進來；家長端（getRegistration／listMyRegistrations）讀到的物件
 * 天生就沒有這個鍵，不受影響，因為那兩支查詢從未合併過備註。
 */
export interface RegistrationWithSchool extends Registration {
  school_name: string | null;
  school_city: string | null;
  school_level: SchoolLevel | null;
  admin_note: string | null;
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
