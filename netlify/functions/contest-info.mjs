/*
  抓一個公開網址的原始 HTML 回傳給前端。

  為什麼要放伺服器端：瀏覽器受同源政策限制，前端 fetch 別人的官網會被
  CORS 擋下。這支函式在 Netlify 上執行，沒有這個限制。

  這裡刻意「只抓不解析」——解析一律由前端的 parseContestText 負責，
  跟使用者直接貼上文字走同一份邏輯。兩邊各寫一份的話，同樣的公告會
  抓出不一樣的結果。

  只有登入的管理員叫得動。少了這道檢查，這支函式就是一個公開的
  網頁代理：任何人都能用我們的網址去抓任何網站，帳單與被封鎖的
  風險都算在我們頭上，而它本來只是後台建比賽時偶爾按一次的功能。
*/

const TIMEOUT_MS = 8000;
const AUTH_TIMEOUT_MS = 5000;
const MAX_BYTES = 800_000;

/*
  只准連公開的網際網路位址。少了這一段，任何人都能拿這支函式當跳板去
  掃內網或雲端的中介資料端點（169.254.169.254），那是典型的 SSRF。
*/
const BLOCKED_HOSTS = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

function isPrivateAddress(hostname) {
  if (BLOCKED_HOSTS.test(hostname)) return true;

  // IPv6 的環回與方括號寫法一律擋掉
  if (hostname === '::1' || hostname.startsWith('[')) return true;

  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false; // 不是 IPv4 字面值，當作網域名
  }
  const [a, b] = parts.map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function checkUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: '網址格式不正確' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: '只支援 http 與 https 的網址' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: '網址不可包含帳號密碼' };
  }
  if (isPrivateAddress(parsed.hostname)) {
    return { ok: false, message: '不支援這個網址' };
  }
  return { ok: true, url: parsed };
}

/*
  只放行管理員。

  驗證的方式是拿呼叫者的權杖去讀 profiles —— 權杖無效的話 PostgREST
  會回 401，有效的話列級權限只會回他自己那一列，所以這一趟同時驗了
  「權杖是真的」與「這個人是管理員」，不必先打一次 /auth/v1/user。

  用 anon 金鑰當 apikey 就夠：真正決定讀得到什麼的是權杖。這裡絕對
  不可以改用 service_role 金鑰，那會讓列級權限失效，任何一個登入的
  家長都會被判成管理員。
*/
async function requireAdmin(req) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
  if (token === '') {
    return { ok: false, status: 401, message: '請先登入' };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    // 環境變數沒設好時「擋下來」而不是「放行」：這種錯要在後台看得到，
    // 不該悄悄退化成沒有身分檢查的版本。
    console.error('缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY');
    return { ok: false, status: 500, message: '伺服器設定不完整' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=role`, {
      signal: controller.signal,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    return { ok: false, status: 502, message: '無法驗證身分，請稍後再試' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { ok: false, status: 401, message: '登入狀態已失效，請重新登入' };
  }

  let rows;
  try {
    rows = await response.json();
  } catch {
    return { ok: false, status: 502, message: '無法驗證身分，請稍後再試' };
  }

  if (!Array.isArray(rows) || rows[0]?.role !== 'admin') {
    return { ok: false, status: 403, message: '只有管理員能使用這個功能' };
  }
  return { ok: true };
}

export default async (req) => {
  // 驗身分放在最前面：未授權的請求連一個外部網址都不該讓它觸發
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) {
    return Response.json({ error: '請提供網址' }, { status: 400 });
  }

  const checked = checkUrl(raw);
  if (!checked.ok) {
    return Response.json({ error: checked.message }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(checked.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // 不少官網對沒有 User-Agent 的請求直接回 403
        'User-Agent': 'Mozilla/5.0 (compatible; ContestInfoBot/1.0)',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    });
  } catch (error) {
    clearTimeout(timer);
    const reason =
      error?.name === 'AbortError' ? '對方網站回應太慢' : '連不上這個網址';
    return Response.json({ error: reason }, { status: 502 });
  }
  clearTimeout(timer);

  // 轉址之後可能落到內網，再檢查一次
  const finalCheck = checkUrl(response.url || raw);
  if (!finalCheck.ok) {
    return Response.json({ error: '不支援這個網址' }, { status: 400 });
  }

  if (!response.ok) {
    return Response.json(
      { error: `對方網站回應 ${response.status}，可能需要登入或不開放讀取` },
      { status: 502 }
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return Response.json({ error: '網頁太大，無法解析' }, { status: 413 });
  }

  return Response.json({
    html: new TextDecoder('utf-8').decode(buffer),
    source_url: response.url || raw,
  });
};
