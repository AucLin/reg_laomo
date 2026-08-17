import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterContest, getTakenCount, updateContest } from '../contests';

const builder = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  order: vi.fn(),
};

for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
  builder[key].mockReturnValue(builder);
}

const from = vi.fn((_table: string) => builder);
const rpc = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    from: (t: string) => from(t),
    rpc: (name: string, params: unknown) => rpc(name, params),
  },
}));

beforeEach(() => {
  from.mockClear();
  rpc.mockClear();
  for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
    builder[key].mockClear();
    builder[key].mockReturnValue(builder);
  }
});

describe('enterContest', () => {
  it('走資料庫函式，所有檢查都在那裡完成', async () => {
    rpc.mockResolvedValue({ data: 'entry-1', error: null });

    await enterContest('contest-1', 'student-1');

    expect(rpc).toHaveBeenCalledWith('enter_contest', {
      p_contest_id: 'contest-1',
      p_student_id: 'student-1',
    });
  });

  /*
    enter_contest() 丟出的訊息本來就是寫給家長看的中文，直接顯示，
    不維護一份前端對照表 —— 對照表要跟資料庫同步，是額外的維護負擔。
  */
  it('資料庫丟出的已知訊息原樣傳給家長', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '名額已滿' } });

    expect(await enterContest('contest-1', 'student-1')).toEqual({
      error: '名額已滿',
    });
  });

  it('帶日期的截止訊息也算已知', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: '報名已於 2026-09-01 截止' },
    });

    expect(await enterContest('contest-1', 'student-1')).toEqual({
      error: '報名已於 2026-09-01 截止',
    });
  });

  it('非預期的資料庫錯誤換成籠統說法，不把原始訊息露給家長', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'could not connect to server' },
    });

    expect(await enterContest('contest-1', 'student-1')).toEqual({
      error: '報名失敗，請稍後再試',
    });
  });
});

describe('updateContest', () => {
  const payload = {
    title: '機器人大賽',
    description: null,
    event_date: '2026-10-01',
    location: '中心教室',
    signup_deadline: '2026-09-01',
    capacity: 20,
    min_grade: 'E1',
    max_grade: 'E6',
    status: 'published' as const,
  };

  /*
    列級權限擋下寫入時 PostgREST 回 204、error 是 null。只看 error
    會誤判成功，一定要用 .select() 讀回的列數判斷。
  */
  it('列級權限擋下時（沒有任何列被改到）回傳錯誤而不是成功', async () => {
    builder.select.mockResolvedValue({ data: [], error: null });

    expect(await updateContest('contest-1', payload)).toEqual({
      error: '修改失敗，請重新登入後再試',
    });
  });

  it('確實改到一列才算成功', async () => {
    builder.select.mockResolvedValue({ data: [{ id: 'contest-1' }], error: null });

    expect(await updateContest('contest-1', payload)).toEqual({ error: null });
  });
});

describe('getTakenCount', () => {
  it('走 SECURITY DEFINER 函式，不自己數 contest_entries', async () => {
    // 家長只讀得到自己的報名，自己數會得到「他自己報了幾筆」
    rpc.mockResolvedValue({ data: 12, error: null });

    expect(await getTakenCount('contest-1')).toBe(12);
    expect(rpc).toHaveBeenCalledWith('contest_taken', {
      p_contest_id: 'contest-1',
    });
    expect(from).not.toHaveBeenCalled();
  });
});
