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
 */
export async function updateRegistration(
  id: string,
  input: Omit<NewRegistration, 'parent_id'>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('registrations').update(input).eq('id', id);
  if (error) {
    console.error('修改報名失敗：', error.message);
    return { error: '修改失敗，可能這筆報名已進入處理流程' };
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

export async function deleteRegistration(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('registrations').delete().eq('id', id);
  if (error) {
    console.error('撤回報名失敗：', error.message);
    return { error: '撤回失敗，請稍後再試' };
  }
  return { error: null };
}

export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
  adminNote: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('registrations')
    .update({
      status,
      // 備註留白時要寫 null，不能寫空字串 —— 沿用整個報名資料層
      // 「可空欄位一律以 null 表示未填」的一致規則
      admin_note: adminNote === '' ? null : adminNote,
    })
    .eq('id', id);

  if (error) {
    console.error('更新報名狀態失敗：', error.message);
    return { error: '更新失敗，請稍後再試' };
  }
  return { error: null };
}

export type { Registration };
