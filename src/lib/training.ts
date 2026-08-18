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
  request_leave() 用 RAISE EXCEPTION 丟出寫給家長看的中文訊息，這裡逐字
  列出來當白名單。不在清單內的錯誤（連線失敗、權限問題）一律換成籠統的
  說法，不把原始的資料庫訊息露出去。
*/
const KNOWN_LEAVE_ERRORS = [
  '找不到這個集訓場次',
  '這不是您的孩子',
  '這個孩子沒有報名這場比賽',
  '這個場次已經開始，請直接聯繫我們',
  '這個場次已經點過名，請直接聯繫我們',
  '這筆請假已經無法取消，請直接聯繫我們',
];

function toParentFacingError(message: string): string {
  const cleaned = message.replace(/^.*?:\s*/s, '').trim();
  return KNOWN_LEAVE_ERRORS.includes(cleaned) ? cleaned : '操作失敗，請稍後再試';
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

/** 某個場次的出缺席。沒有列代表還沒點名也沒請假 */
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

/** 家長端：自己孩子的全部出缺席，一次取回後在畫面上對照場次 */
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
  status: Exclude<AttendanceStatus, 'excused'>
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('training_attendance')
    .upsert(
      { session_id: sessionId, entry_id: entryId, status, leave_reason: null },
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

/** 清掉點名結果，回到「還沒點名」 */
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
 * 家長請假。所有檢查（是不是自己的孩子、場次有沒有開始、有沒有被點過名）
 * 都在資料庫的 request_leave() 裡完成，前端繞不過去。
 */
export async function requestLeave(
  sessionId: string,
  entryId: string,
  reason: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_leave', {
    p_session_id: sessionId,
    p_entry_id: entryId,
    p_reason: reason,
  });

  if (error) {
    console.error('請假失敗：', error.message);
    return { error: toParentFacingError(error.message) };
  }
  return { error: null };
}

export async function cancelLeave(
  sessionId: string,
  entryId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancel_leave', {
    p_session_id: sessionId,
    p_entry_id: entryId,
  });

  if (error) {
    console.error('取消請假失敗：', error.message);
    return { error: toParentFacingError(error.message) };
  }
  return { error: null };
}
