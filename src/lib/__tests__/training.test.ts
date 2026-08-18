import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cancelTrainingSignup,
  createSession,
  listAttendanceForSessions,
  markAttendance,
  signupTraining,
} from '../training';

const builder = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  order: vi.fn(),
};

const rpc = vi.fn((_name: string, _params: unknown) => ({ error: null }) as unknown);
const from = vi.fn((_table: string) => builder);

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (name: string, params: unknown) => rpc(name, params),
    from: (table: string) => from(table),
  },
}));

beforeEach(() => {
  for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
    builder[key].mockClear();
    builder[key].mockReturnValue(builder);
  }
  rpc.mockClear().mockResolvedValue({ error: null });
  from.mockClear().mockReturnValue(builder);
});

/*
  家長挑時段一律走資料庫函式，不開 INSERT 政策 —— 要檢查的條件有四個
  （是我的孩子、錄取了、還沒開始、還沒點名），寫成政策就是四段 EXISTS，
  改錯一段就是家長動得了別人的紀錄。
*/
describe('signupTraining', () => {
  it('走 signup_training 函式，帶場次與報名', async () => {
    await signupTraining('session-1', 'entry-1');
    expect(rpc).toHaveBeenCalledWith('signup_training', {
      p_session_id: 'session-1',
      p_entry_id: 'entry-1',
    });
  });

  it('成功時不回傳錯誤', async () => {
    expect(await signupTraining('session-1', 'entry-1')).toEqual({ error: null });
  });

  /*
    資料庫用 RAISE EXCEPTION 丟出寫給家長看的中文訊息。PostgREST 會在
    前面加一段前綴，要剝掉才對得上白名單。
  */
  it('資料庫丟的中文訊息原樣傳給家長', async () => {
    rpc.mockResolvedValue({
      error: { message: 'P0001: 這個場次已經開始，請直接聯繫我們' },
    });
    const { error } = await signupTraining('session-1', 'entry-1');
    expect(error).toBe('這個場次已經開始，請直接聯繫我們');
  });

  it('還沒錄取的孩子挑不了，訊息說得出原因', async () => {
    rpc.mockResolvedValue({
      error: { message: 'P0001: 這個孩子還沒錄取這場比賽' },
    });
    const { error } = await signupTraining('session-1', 'entry-1');
    expect(error).toBe('這個孩子還沒錄取這場比賽');
  });

  /*
    白名單以外的錯誤（連線失敗、權限問題）不能原樣露出去 —— 那些訊息
    會把資料表名稱、政策名稱洩漏給家長看。
  */
  it('沒見過的錯誤換成籠統的說法', async () => {
    rpc.mockResolvedValue({
      error: { message: 'permission denied for table training_attendance' },
    });
    const { error } = await signupTraining('session-1', 'entry-1');
    expect(error).toBe('操作失敗，請稍後再試');
  });
});

describe('cancelTrainingSignup', () => {
  it('走 cancel_training_signup 函式', async () => {
    await cancelTrainingSignup('session-1', 'entry-1');
    expect(rpc).toHaveBeenCalledWith('cancel_training_signup', {
      p_session_id: 'session-1',
      p_entry_id: 'entry-1',
    });
  });

  it('已經不能取消時把原因說給家長聽', async () => {
    rpc.mockResolvedValue({
      error: { message: 'P0001: 這個時段已經不能取消，請直接聯繫我們' },
    });
    const { error } = await cancelTrainingSignup('session-1', 'entry-1');
    expect(error).toBe('這個時段已經不能取消，請直接聯繫我們');
  });
});

describe('markAttendance', () => {
  /*
    同一個孩子重複點名要覆蓋前一次，不是新增一列 —— 點錯改回來是現場
    最常發生的事。靠的是 session_id + entry_id 這組唯一鍵。
  */
  it('用 upsert 覆蓋前一次的結果', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'a-1' }], error: null });
    await markAttendance('session-1', 'entry-1', 'present');

    expect(builder.upsert).toHaveBeenCalledWith(
      { session_id: 'session-1', entry_id: 'entry-1', status: 'present' },
      { onConflict: 'session_id,entry_id' }
    );
  });

  /*
    列級權限擋下寫入時 PostgREST 回 204、error 是 null。只看 error
    會把「根本沒寫進去」當成成功。
  */
  it('回傳 0 筆時當成失敗，不能被誤判成點名成功', async () => {
    builder.select.mockResolvedValue({ data: [], error: null });
    const { error } = await markAttendance('session-1', 'entry-1', 'present');
    expect(error).not.toBeNull();
  });
});

describe('createSession', () => {
  it('回傳 0 筆時當成失敗', async () => {
    builder.select.mockResolvedValue({ data: [], error: null });
    const { error } = await createSession({
      contest_id: 'contest-1',
      session_date: '2026-09-06',
      start_time: '09:00',
      end_time: '11:00',
      note: null,
    });
    expect(error).not.toBeNull();
  });
});

describe('listAttendanceForSessions', () => {
  it('沒有場次時不查詢，直接回空陣列', async () => {
    expect(await listAttendanceForSessions([])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('一次撈完所有場次的名單', async () => {
    builder.in.mockResolvedValue({ data: [], error: null });
    await listAttendanceForSessions(['s-1', 's-2']);
    expect(builder.in).toHaveBeenCalledWith('session_id', ['s-1', 's-2']);
  });
});
