import { supabase } from './supabase';
import type {
  Contest,
  ContestEntry,
  ContestStatus,
  RegistrationStatus,
} from './types';

export interface NewContest {
  title: string;
  description: string | null;
  event_date: string;
  location: string;
  signup_deadline: string;
  capacity: number | null;
  min_grade: string;
  max_grade: string;
  status: ContestStatus;
}

/**
 * enter_contest() 會用 RAISE EXCEPTION 丟出寫給家長看的中文訊息，
 * 這裡逐字列出來當白名單。不在清單內的錯誤（連線失敗、權限問題等）
 * 一律換成籠統的說法，不把原始的資料庫訊息露給使用者。
 *
 * 「報名已於 … 截止」帶日期參數，所以用開頭比對而不是完全相等。
 */
const KNOWN_ENTRY_ERRORS = [
  '找不到這場比賽',
  '這不是您的孩子',
  '這場比賽目前不開放報名',
  '這場比賽的參賽年級不符',
  '名額已滿',
  '這個孩子已經報名過這場比賽',
];

function toParentFacingError(message: string): string {
  const cleaned = message.replace(/^.*?:\s*/s, '').trim();
  if (KNOWN_ENTRY_ERRORS.includes(cleaned) || cleaned.startsWith('報名已於')) {
    return cleaned;
  }
  return '報名失敗，請稍後再試';
}

/** 家長與訪客看得到的比賽：已發佈與已關閉，草稿被列級權限擋在外面 */
export async function listOpenContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .in('status', ['published', 'closed'])
    .order('event_date', { ascending: true });

  if (error) {
    console.error('讀取比賽清單失敗：', error.message);
    return [];
  }
  return (data ?? []) as Contest[];
}

/**
 * 讀單一場比賽，不篩狀態。
 *
 * 分享連結與預覽都走這裡：管理員讀得到草稿（列級權限給的），家長讀不到，
 * 拿到 null 就會看到「找不到這場比賽」。同一支函式同時撐起兩種情境，
 * 不必為預覽另外開一條路。
 */
export async function getContest(id: string): Promise<Contest | null> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('讀取比賽失敗：', error.message);
    return null;
  }
  return data as Contest | null;
}

/** 後台用：草稿也要看得到。列級權限只讓管理員讀到草稿 */
export async function listAllContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .order('event_date', { ascending: false });

  if (error) {
    console.error('讀取比賽清單失敗：', error.message);
    return [];
  }
  return (data ?? []) as Contest[];
}

export async function createContest(
  input: NewContest
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contests')
    .insert(input)
    .select('id');

  if (error) {
    console.error('新增比賽失敗：', error.message);
    return { id: null, error: '新增失敗，請稍後再試' };
  }
  const id = (data ?? [])[0]?.id as string | undefined;
  if (!id) return { id: null, error: '新增失敗，請稍後再試' };
  return { id, error: null };
}

/*
  列級權限擋下寫入時 PostgREST 回 204、error 是 null —— 不能只看 error
  判斷成功，一定要接 .select() 讀回實際受影響的列數。
*/
export async function updateContest(
  id: string,
  input: NewContest
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('contests')
    .update(input)
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('修改比賽失敗：', error.message);
    return { error: '修改失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '修改失敗，請重新登入後再試' };
  }
  return { error: null };
}

/** 刪除比賽會連帶刪掉所有報名（外鍵是 ON DELETE CASCADE），呼叫端要先確認 */
export async function deleteContest(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('contests')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('刪除比賽失敗：', error.message);
    return { error: '刪除失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '刪除失敗，請重新登入後再試' };
  }
  return { error: null };
}

/**
 * 已報名人數。走 SECURITY DEFINER 函式而不是自己數 ——
 * 家長只讀得到自己的報名，自己數會得到「他自己報了幾筆」。
 */
export async function getTakenCount(contestId: string): Promise<number> {
  const { data, error } = await supabase.rpc('contest_taken', {
    p_contest_id: contestId,
  });

  if (error) {
    console.error('讀取報名人數失敗：', error.message);
    return 0;
  }
  return (data as number | null) ?? 0;
}

export async function getTakenCounts(
  contestIds: string[]
): Promise<Map<string, number>> {
  // 一場比賽一次呼叫。比賽數量是個位數，不值得為此做批次介面。
  const counts = await Promise.all(
    contestIds.map(async (id) => [id, await getTakenCount(id)] as const)
  );
  return new Map(counts);
}

/**
 * 報名比賽。所有檢查（身分、狀態、截止日、年級、名額、重複）都在資料庫
 * 的 enter_contest() 裡完成，前端繞不過去。
 */
export async function enterContest(
  contestId: string,
  studentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('enter_contest', {
    p_contest_id: contestId,
    p_student_id: studentId,
  });

  if (error) {
    console.error('比賽報名失敗：', error.message);
    return { error: toParentFacingError(error.message) };
  }
  return { error: null };
}

export async function listMyEntries(): Promise<ContestEntry[]> {
  const { data, error } = await supabase
    .from('contest_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('讀取比賽報名失敗：', error.message);
    return [];
  }
  return (data ?? []) as ContestEntry[];
}

/** 後台用：某場比賽的所有報名 */
export async function listContestEntries(
  contestId: string
): Promise<ContestEntry[]> {
  const { data, error } = await supabase
    .from('contest_entries')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('讀取比賽報名失敗：', error.message);
    return [];
  }
  return (data ?? []) as ContestEntry[];
}

export async function updateEntryStatus(
  id: string,
  status: RegistrationStatus
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('contest_entries')
    .update({ status })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('更新報名狀態失敗：', error.message);
    return { error: '更新失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '更新失敗，請重新登入後再試' };
  }
  return { error: null };
}

/** 家長取消自己的報名。列級權限只允許刪待審核的那些 */
export async function cancelMyEntry(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('contest_entries')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('取消比賽報名失敗：', error.message);
    return { error: '取消失敗，請稍後再試' };
  }
  if ((data ?? []).length === 0) {
    return { error: '這筆報名已進入處理流程，無法取消' };
  }
  return { error: null };
}
