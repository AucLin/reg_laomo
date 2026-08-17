import { supabase } from './supabase';
import type { Gender, StudentWithSchool } from './types';

export interface NewStudent {
  parent_id: string;
  name: string;
  gender: Gender;
  birthday: string;
  school_id: string | null;
  school_name_raw: string | null;
  grade: string;
  class_name: string | null;
}

/**
 * 讀取一律走 students_with_school 檢視表（左連接學校），寫入一律走
 * students 原表。檢視表帶著 security_invoker，列級權限照樣生效。
 * 這與 registrations.ts 是同一套慣例。
 */
const VIEW = 'students_with_school';

export async function listMyStudents(): Promise<StudentWithSchool[]> {
  // 不加 parent_id 條件 —— 列級權限已經把別人的孩子擋在資料庫外，
  // 前端再加一次只是重複，而且會讓人誤以為安全性是靠前端達成的
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('讀取孩子清單失敗：', error.message);
    return [];
  }
  return (data ?? []) as StudentWithSchool[];
}

export async function createStudent(
  input: NewStudent
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('students')
    .insert(input)
    .select('id');

  if (error) {
    console.error('新增孩子失敗：', error.message);
    return { id: null, error: '新增失敗，請稍後再試' };
  }
  const id = (data ?? [])[0]?.id as string | undefined;
  if (!id) {
    return { id: null, error: '新增失敗，請稍後再試' };
  }
  return { id, error: null };
}

/**
 * 修改孩子資料。
 *
 * 列級權限擋下寫入時 PostgREST 回傳 204、error 是 null —— 不能只看
 * error 判斷成功，一定要接 .select() 讀回實際受影響的列數。
 * 這件事本專案在 scripts/verify-rls.ts 已經實測證明過。
 */
export async function updateStudent(
  id: string,
  input: Omit<NewStudent, 'parent_id'>
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('students')
    .update(input)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('修改孩子失敗：', error.message);
    return { error: '修改失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '修改失敗，請重新登入後再試' };
  }
  return { error: null };
}

/** PostgreSQL 的外鍵違規代碼。孩子有報名紀錄時刪除會撞到這個。 */
const FOREIGN_KEY_VIOLATION = '23503';

export async function deleteStudent(
  id: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('刪除孩子失敗：', error.message);
    /*
      registrations.student_id 是 ON DELETE RESTRICT，有報名紀錄的孩子
      刪不掉。把外鍵違規翻成家長看得懂的說明 —— 直接顯示
      「violates foreign key constraint」是最差的作法。
    */
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: '這個孩子已有報名紀錄，如需更正請聯繫我們' };
    }
    return { error: '刪除失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '刪除失敗，請重新登入後再試' };
  }
  return { error: null };
}
