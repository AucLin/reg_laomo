import { supabase } from './supabase';
import type {
  Gender,
  Registration,
  RegistrationStatus,
  RegistrationWithSchool,
  Relation,
} from './types';

export interface NewRegistration {
  parent_id: string;
  /** 這筆報名屬於哪個孩子；學生欄位仍逐欄保留，那是送出當下的快照 */
  student_id: string;
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
}

/**
 * 讀取一律走 registrations_with_school 檢視表（左連接學校），
 * 寫入一律走 registrations 原表。檢視表帶著 security_invoker，
 * 列級權限照樣生效。
 */
const VIEW = 'registrations_with_school';

export async function createRegistration(
  input: NewRegistration
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('registrations').insert(input);
  if (error) {
    console.error('報名送出失敗：', error.message);
    return { error: '送出失敗，請稍後再試' };
  }
  return { error: null };
}

/** 讀單筆報名，供編輯畫面預先填入 */
export async function getRegistration(
  id: string
): Promise<RegistrationWithSchool | null> {
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('讀取報名失敗：', error.message);
    return null;
  }
  return data as RegistrationWithSchool | null;
}

/**
 * 修改既有報名。寫入走原表而非檢視表。
 * 只有待審核的報名改得動 —— 這條限制在資料庫的列級權限裡，
 * 前端就算送出也會被擋下。
 *
 * 列級權限擋下寫入時（比對到 0 筆可見列），PostgREST 回傳 204、
 * error 是 null —— 不能只看 error 是否為 null 判斷成功，一定要接
 * .select() 讀回實際受影響的列數。這件事本專案在
 * scripts/verify-rls.ts 已經實測證明過（見該檔案的相關註解）。
 */
/*
  編輯報名不換孩子：student_id 是這筆報名屬於誰，換人等於另一筆報名，
  不是同一筆的修改。學生欄位仍然改得動 —— 那是送出當下的快照，
  家長把年級打錯本來就該能改。
*/
export type RegistrationEdit = Omit<NewRegistration, 'parent_id' | 'student_id'>;

export async function updateRegistration(
  id: string,
  input: RegistrationEdit
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('registrations')
    .update(input)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('修改報名失敗：', error.message);
    return { error: '修改失敗，可能這筆報名已進入處理流程' };
  }
  if ((data ?? []).length === 0) {
    return { error: '這筆報名已進入處理流程，無法修改' };
  }
  return { error: null };
}

export async function listMyRegistrations(): Promise<RegistrationWithSchool[]> {
  // 不需要在這裡加 parent_id 條件 —— 列級權限已經把別人的資料擋在
  // 資料庫外，前端再加條件只是重複。
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('讀取報名紀錄失敗：', error.message);
    return [];
  }
  return (data ?? []) as RegistrationWithSchool[];
}

/**
 * 撤回既有報名。同 updateRegistration，列級權限擋下時 error 是 null，
 * 一定要用 .select() 讀回實際刪除的列數才能判斷是否真的成功。
 */
export async function deleteRegistration(
  id: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('撤回報名失敗：', error.message);
    return { error: '撤回失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '這筆報名已進入處理流程，無法撤回' };
  }
  return { error: null };
}

/**
 * 更新報名狀態與內部備註。
 *
 * 狀態寫 registrations、備註寫獨立的 registration_notes 表 —— 這張表
 * 只開放 is_admin() 的列級權限，家長完全查不到，才真正兌現「家長看
 * 不到內部備註」這個承諾（放在同一張表只靠前端不選欄位擋不住自己
 * 構造請求的人）。兩個寫入依序執行、非同一交易，狀態寫入若失敗或被
 * 列級權限擋下就直接回錯，不再繼續寫備註。
 */
export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
  adminNote: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('registrations')
    .update({ status })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('更新報名狀態失敗：', error.message);
    return { error: '更新失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '更新失敗，這筆報名可能已被其他人異動' };
  }

  const { error: noteError } = await supabase.from('registration_notes').upsert({
    registration_id: id,
    // 備註留白時要寫 null，不能寫空字串 —— 沿用整個報名資料層
    // 「可空欄位一律以 null 表示未填」的一致規則
    note: adminNote === '' ? null : adminNote,
  });

  if (noteError) {
    console.error('更新內部備註失敗：', noteError.message);
    return { error: '狀態已更新，但備註儲存失敗，請重新整理後再試一次' };
  }

  return { error: null };
}

export type { Registration };
