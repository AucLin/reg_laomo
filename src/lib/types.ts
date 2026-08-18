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

/*
  沒有地址與電話。名錄裡那兩欄是教育部資料帶進來的，畫面上從來沒顯示過，
  卻要跟著學校異動一起維護 —— 康橋青山校區在名錄裡就掛著秀岡的地址。
  一份沒人看、也沒人會去更正的資料，留著只會有一天被誤當成正確的。
*/
export interface School {
  id: string;
  code: string;
  name: string;
  level: SchoolLevel;
  city: string;
}

export interface Registration {
  id: string;
  parent_id: string;
  /*
    這筆報名屬於哪個孩子。學生欄位（姓名、年級、學校…）仍然逐欄保留，
    那是「報名送出當下」的快照 —— 孩子升年級或轉學之後，舊報名要維持
    原樣才對得起當時的審核紀錄。student_id 只用來把報名歸到孩子名下。
    舊資料回填前可能是 null，型別要留住這個可能。
  */
  student_id: string | null;
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

export type ContestStatus = 'draft' | 'published' | 'closed';

export interface Contest {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string;
  signup_deadline: string;
  /** null 代表不限名額 */
  capacity: number | null;
  min_grade: string;
  max_grade: string;
  status: ContestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 比賽報名。狀態與課程報名共用同一組，後台的狀態徽章可以直接重用。 */
export interface ContestEntry {
  id: string;
  contest_id: string;
  student_id: string;
  parent_id: string;
  /** 報名當下的快照，孩子之後升年級或改名都不會動到這裡 */
  grade: string;
  student_name: string;
  status: RegistrationStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = {
  draft: '草稿',
  published: '報名中',
  closed: '已關閉',
};

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

/*
  老莫的招生範圍是北部，選擇器與後台篩選都以此為預設。放進基隆與桃園
  是因為預設範圍太窄的代價很不對稱：搜不到的家長多半不會去點「顯示全部
  縣市」，而是退回自由填寫，我們就收到一個手打的校名 —— 那正是這套
  選擇器要消滅的東西。多幾個縣市只是多一點搜尋結果。

  縣市名一律用名錄的正式寫法（臺不是台），這個常數是拿去跟資料庫比對的。
*/
export const DEFAULT_CITIES = ['臺北市', '新北市', '基隆市', '桃園市'];

/*
  搜尋結果的排序優先縣市。四個預設縣市裡，實際來上課的孩子絕大多數在
  雙北，所以同樣命中關鍵字時雙北的學校排前面 —— 家長打「中正國小」跳出
  一整排同名學校，第一眼看到的應該是他家那所。

  排序而不是篩選：桃園、基隆的學校照樣列得出來，只是排在後面。
  順序就是這個陣列的順序，臺北市在新北市之前。
*/
export const PRIORITY_CITIES = ['臺北市', '新北市'];

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

const LEVEL_BY_GRADE_PREFIX: Record<string, SchoolLevel> = {
  E: 'elementary',
  J: 'junior',
  S: 'senior',
};

/**
 * 從年級代碼反推學校級別。
 *
 * 選既有孩子來報名時不能拿 school_level 當級別：那是左連接學校名錄來的，
 * 自由填寫校名的孩子會是 null，退回預設值就可能把國中生標成國小，
 * 讓「年級與學校級別不符」的檢查誤擋。年級代碼的字首才是可靠來源，
 * 資料庫的 students_grade_valid 檢查限制式保證它一定是 E／J／S 開頭。
 */
export function levelFromGrade(grade: string): SchoolLevel {
  return LEVEL_BY_GRADE_PREFIX[grade[0]] ?? 'elementary';
}

/*
  集訓。場次綁在比賽底下，一場一場排；出缺席沒有「還沒點名」這個狀態，
  沒有列就是還沒點名 —— 少一種狀態就少一次同步的負擔，新錄取的孩子不必
  回頭補建列。
*/
export interface TrainingSession {
  id: string;
  contest_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  /*
    上課地點。目前只有一間教室，排場次時不再填，這裡一律是 null；
    欄位留著是因為日後真的租了別的場地就用得上，而讓一個已經沒人寫入
    的欄位躺著，比刪掉再回頭補一次遷移便宜。
  */
  location: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/*
  沒有列代表這個孩子沒挑這個時段，也就是不會來 —— 沒挑不是一種狀態，
  是沒有紀錄。signed_up 是家長挑了、還沒上到課；present／absent 是
  上課當天管理員點的名。
*/
export type AttendanceStatus = 'signed_up' | 'present' | 'absent';

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  signed_up: '會來',
  present: '已到',
  absent: '未到',
};

export interface TrainingAttendance {
  id: string;
  session_id: string;
  entry_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

/** 時間欄位資料庫存的是 HH:MM:SS，畫面上只需要時分 */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}
