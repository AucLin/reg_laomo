import { supabase } from './supabase';
import type { AttendanceStatus, TrainingAttendance, TrainingSession } from './types';

export interface NewTrainingSession {
  contest_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

/*
  signup_training() 與 cancel_training_signup() 用 RAISE EXCEPTION 丟出
  寫給家長看的中文訊息，這裡逐字列出來當白名單。不在清單內的錯誤
  （連線失敗、權限問題）一律換成籠統的說法，不把原始的資料庫訊息露出去。
*/
const KNOWN_SIGNUP_ERRORS = [
  '找不到這個集訓場次',
  '這不是您的孩子',
  '這個孩子沒有報名這場比賽',
  '這個孩子還沒錄取這場比賽',
  '這個場次已經開始，請直接聯繫我們',
  '這個場次已經點過名，請直接聯繫我們',
  '這個時段已經不能取消，請直接聯繫我們',
];

function toParentFacingError(message: string): string {
  const cleaned = message.replace(/^.*?:\s*/s, '').trim();
  return KNOWN_SIGNUP_ERRORS.includes(cleaned) ? cleaned : '操作失敗，請稍後再試';
}

/** 某場比賽的集訓場次，依日期時間排序 */
export async function listSessions(contestId: string): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('contest_id', contestId)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('讀取集訓場次失敗：', error.message);
    return [];
  }
  return (data ?? []) as TrainingSession[];
}

/**
 * 家長端：一次取回自己孩子有份的所有場次。
 *
 * 列級權限已經把範圍限縮到「自己孩子報名的比賽」，所以這裡不必再帶條件。
 */
export async function listMySessions(): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('讀取集訓場次失敗：', error.message);
    return [];
  }
  return (data ?? []) as TrainingSession[];
}

/*
  列級權限擋下寫入時 PostgREST 回 204、error 是 null —— 不能只看 error
  判斷成功，一定要接 .select() 讀回實際受影響的列數。
*/
export async function createSession(
  input: NewTrainingSession
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('training_sessions')
    .insert(input)
    .select('id');

  if (error) {
    console.error('新增集訓場次失敗：', error.message);
    return { error: '新增失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '新增失敗，請重新登入後再試' };
  }
  return { error: null };
}

/*
  一次建立整期的場次。

  PostgREST 的批次寫入是一個交易，所以結果只有全建好或全沒建 —— 不會
  出現「排了一半」讓管理員得自己找出缺哪幾天。回傳實際建立的筆數而不是
  只回成功與否：畫面上要告訴老莫「排好 8 場」，那個數字得是資料庫認的。
*/
export async function createSessions(
  rows: NewTrainingSession[]
): Promise<{ created: number; error: string | null }> {
  if (rows.length === 0) return { created: 0, error: null };

  const { data, error } = await supabase
    .from('training_sessions')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('批次新增集訓場次失敗：', error.message);
    return { created: 0, error: '排課失敗，請稍後再試' };
  }
  // 列級權限擋下時回 204、error 是 null，只能靠列數判斷
  if ((data ?? []).length === 0) {
    return { created: 0, error: '排課失敗，請重新登入後再試' };
  }
  return { created: (data ?? []).length, error: null };
}

export async function updateSession(
  id: string,
  input: Omit<NewTrainingSession, 'contest_id'>
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('training_sessions')
    .update(input)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('修改集訓場次失敗：', error.message);
    return { error: '修改失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '修改失敗，請重新登入後再試' };
  }
  return { error: null };
}

/** 刪除場次會連帶刪掉那場的點名紀錄（外鍵是 ON DELETE CASCADE） */
export async function deleteSession(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('刪除集訓場次失敗：', error.message);
    return { error: '刪除失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '刪除失敗，請重新登入後再試' };
  }
  return { error: null };
}

/** 某個場次的名單。沒有列代表這個孩子沒挑這個時段，也就是不會來 */
export async function listAttendance(
  sessionId: string
): Promise<TrainingAttendance[]> {
  const { data, error } = await supabase
    .from('training_attendance')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    console.error('讀取點名紀錄失敗：', error.message);
    return [];
  }
  return (data ?? []) as TrainingAttendance[];
}

/**
 * 管理員端：一次取回多個場次的名單，用來在場次列表上顯示「幾人會來」。
 *
 * 場次數量是個位數，一次 .in() 撈完就好，不必每張卡片各查一次。
 */
export async function listAttendanceForSessions(
  sessionIds: string[]
): Promise<TrainingAttendance[]> {
  if (sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('training_attendance')
    .select('*')
    .in('session_id', sessionIds);

  if (error) {
    console.error('讀取名單失敗：', error.message);
    return [];
  }
  return (data ?? []) as TrainingAttendance[];
}

/** 家長端：自己孩子挑過的全部時段，一次取回後在畫面上對照場次 */
export async function listMyAttendance(): Promise<TrainingAttendance[]> {
  const { data, error } = await supabase
    .from('training_attendance')
    .select('*');

  if (error) {
    console.error('讀取出缺席失敗：', error.message);
    return [];
  }
  return (data ?? []) as TrainingAttendance[];
}

/**
 * 管理員點名。同一個孩子重複點名就覆蓋掉前一次，不是新增一列 ——
 * 點錯改回來是現場最常發生的事。
 */
export async function markAttendance(
  sessionId: string,
  entryId: string,
  status: Exclude<AttendanceStatus, 'signed_up'>
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('training_attendance')
    .upsert(
      { session_id: sessionId, entry_id: entryId, status },
      { onConflict: 'session_id,entry_id' }
    )
    .select('id');

  if (error) {
    console.error('點名失敗：', error.message);
    return { error: '點名失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '點名失敗，請重新登入後再試' };
  }
  return { error: null };
}

/**
 * 清掉這一列，回到「沒挑這個時段」。
 *
 * 管理員用這個把點錯的名收回來 —— 收回之後那個孩子就不在名單上了，
 * 要讓他回到名單得由家長重新挑，或管理員直接標「已到」。
 */
export async function clearAttendance(
  sessionId: string,
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('training_attendance')
    .delete()
    .eq('session_id', sessionId)
    .eq('entry_id', entryId);

  if (error) {
    console.error('清除點名失敗：', error.message);
    return { error: '清除失敗，請稍後再試' };
  }
  return { error: null };
}

/**
 * 家長挑一個時段。所有檢查（是不是自己的孩子、有沒有錄取、場次有沒有
 * 開始、有沒有被點過名）都在資料庫的 signup_training() 裡完成，
 * 前端繞不過去。
 */
export async function signupTraining(
  sessionId: string,
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('signup_training', {
    p_session_id: sessionId,
    p_entry_id: entryId,
  });

  if (error) {
    console.error('挑選時段失敗：', error.message);
    return { error: toParentFacingError(error.message) };
  }
  return { error: null };
}

/** 家長改變主意，取消挑好的時段。點過名的動不了 */
export async function cancelTrainingSignup(
  sessionId: string,
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancel_training_signup', {
    p_session_id: sessionId,
    p_entry_id: entryId,
  });

  if (error) {
    console.error('取消時段失敗：', error.message);
    return { error: toParentFacingError(error.message) };
  }
  return { error: null };
}
