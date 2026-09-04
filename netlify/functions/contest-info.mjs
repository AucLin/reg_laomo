/*
  抓一個公開網址的原始 HTML 回傳給前端。

  為什麼要放伺服器端：瀏覽器受同源政策限制，前端 fetch 別人的官網會被
  CORS 擋下。這支函式在 Netlify 上執行，沒有這個限制。

  這裡刻意「只抓不解析」——解析一律由前端的 parseContestText 負責，
  跟使用者直接貼上文字走同一份邏輯。兩邊各寫一份的話，同樣的公告會
  抓出不一樣的結果。
*/

const TIMEOUT_MS = 8000;
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

export default async (req) => {
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
