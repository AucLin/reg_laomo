import { supabase } from './supabase';
import type { RegistrationWithSchool, StudentWithSchool, UserRole } from './types';

/**
 * 家長帳號。信箱來自 auth.users，前端的 anon 金鑰查不到那張表，
 * 所以整筆資料走 list_users() 這支函式取回（見
 * supabase/migrations/20260823100000_admin_list_users.sql）。
 */
export interface AdminUserRow {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  created_at: string;
  email: string;
  /** null 代表還沒點過驗證信，這種帳號登不進來 */
  email_confirmed_at: string | null;
  /** null 代表註冊後從來沒登入過 */
  last_sign_in_at: string | null;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('list_users');

  if (error) {
    console.error('讀取帳號名冊失敗：', error.message);
    return [];
  }
  return (data ?? []) as AdminUserRow[];
}

/**
 * 這個家長名下的孩子。
 *
 * 這裡要寫 parent_id 條件 —— 跟家長端的 listMyStudents() 不同：那邊
 * 靠列級權限自動只回自己的，這邊管理員讀得到全部，不指定就是全部人的
 * 孩子都撈回來。
 */
export async function listStudentsOf(parentId: string): Promise<StudentWithSchool[]> {
  const { data, error } = await supabase
    .from('students_with_school')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('讀取孩子清單失敗：', error.message);
    return [];
  }
  return (data ?? []) as StudentWithSchool[];
}

/** 這個家長送出過的課程報名，新的在前面 */
export async function listRegistrationsOf(
  parentId: string
): Promise<RegistrationWithSchool[]> {
  const { data, error } = await supabase
    .from('registrations_with_school')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('讀取報名紀錄失敗：', error.message);
    return [];
  }
  return (data ?? []) as RegistrationWithSchool[];
}

/**
 * 用關鍵字過濾名冊。
 *
 * 在前端過濾而不是丟給資料庫：帳號數量是幾十筆，一次撈完再篩，比每打
 * 一個字就往返一趟簡單，家長打字時也不會有延遲。電話與信箱都拿掉大小寫
 * 差異再比，家長報上來的信箱常常大小寫跟註冊時不一樣。
 */
export function filterUsers(users: AdminUserRow[], keyword: string): AdminUserRow[] {
  const needle = keyword.trim().toLowerCase();
  if (needle === '') return users;

  return users.filter((user) =>
    [user.full_name, user.email, user.phone].some((field) =>
      field?.toLowerCase().includes(needle)
    )
  );
}
