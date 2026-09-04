// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../contest-info.mjs';

/*
  測的重點不只是「有沒有回對狀態碼」，還有「擋下來的時候到底有沒有
  去抓那個網址」—— 先抓再擋等於沒擋。
*/

const PROFILES = 'https://project.supabase.co/rest/v1/profiles?select=role';
const TARGET = 'https://example.com/contest';

function request(token) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return {
    url: `https://site.example/api/contest-info?url=${encodeURIComponent(TARGET)}`,
    headers,
  };
}

/** 讓 profiles 回指定的角色，目標網址回一段 HTML */
function mockFetch({ profileStatus = 200, role = 'admin' } = {}) {
  return vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === PROFILES) {
      return new Response(role === null ? '[]' : JSON.stringify([{ role }]), {
        status: profileStatus,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('<html>比賽公告</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  });
}

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('身分檢查', () => {
  it('沒帶權杖回 401，而且一個外部請求都不發', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request(null));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('權杖無效回 401，不去抓目標網址', async () => {
    const fetchMock = mockFetch({ profileStatus: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request('expired-token'));

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(PROFILES);
  });

  it('登入的家長回 403，不去抓目標網址', async () => {
    const fetchMock = mockFetch({ role: 'parent' });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request('parent-token'));

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('環境變數沒設好時擋下來，不是放行', async () => {
    delete process.env.VITE_SUPABASE_ANON_KEY;
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await handler(request('admin-token'));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('管理員照常抓得到網頁', async () => {
    const fetchMock = mockFetch({ role: 'admin' });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request('admin-token'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.html).toContain('比賽公告');
    expect(fetchMock.mock.calls[1][0].toString()).toBe(TARGET);
  });

  it('驗過身分之後，內網位址照樣擋掉', async () => {
    const fetchMock = mockFetch({ role: 'admin' });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler({
      url: 'https://site.example/api/contest-info?url=http://192.168.0.1/admin',
      headers: new Headers({ authorization: 'Bearer admin-token' }),
    });

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
