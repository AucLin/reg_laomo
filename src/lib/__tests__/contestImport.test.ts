import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importContestFromUrl } from '../contestImport';

const getSession = vi.fn();

vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'the-token' } } });
});

describe('importContestFromUrl', () => {
  it('把登入權杖帶給 /api/contest-info', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ html: '<p>比賽公告</p>', source_url: 'https://example.com/c' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await importContestFromUrl('https://example.com/c');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/contest-info?url=');
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer the-token' });
    expect(result.error).toBeNull();
    expect(result.sourceUrl).toBe('https://example.com/c');
  });

  /*
    沒有登入就不必打過去 —— 那支函式一定會回 401，先擋下來還能給出
    「請重新登入」這種家長看得懂的訊息，而不是一句讀取失敗。
  */
  it('沒有登入狀態時直接回錯誤，不發請求', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await importContestFromUrl('https://example.com/c');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.parsed).toBeNull();
    expect(result.error).toBe('登入狀態已失效，請重新登入');
  });

  it('函式回的錯誤訊息原樣帶給使用者', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: '只有管理員能使用這個功能' }, 403))
    );

    const result = await importContestFromUrl('https://example.com/c');

    expect(result.error).toBe('只有管理員能使用這個功能');
  });
});
