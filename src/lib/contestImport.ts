import { supabase } from './supabase';
import { parseContestText, type ParsedContest } from './contestParse';

export interface ImportResult {
  parsed: ParsedContest | null;
  sourceUrl: string | null;
  error: string | null;
}

/**
 * 從比賽官網的網址抓資訊回來。
 *
 * 真正去抓網頁的是 Netlify 上的 /api/contest-info —— 瀏覽器受同源政策
 * 限制，前端直接抓別人的官網會被 CORS 擋下。那支函式只負責抓回原始
 * HTML 與擋掉內網位址，解析一律用 parseContestText，跟「貼上文字」
 * 走的是同一份邏輯，兩邊才不會給出不同的結果。
 *
 * 要帶登入權杖過去：那支函式只放行管理員，否則它就成了誰都能用的
 * 網頁代理。權杖由 Supabase 的用戶端管理，過期會自動換新，這裡取到
 * 的一定是當下有效的那一把。
 */
export async function importContestFromUrl(url: string): Promise<ImportResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { parsed: null, sourceUrl: null, error: '登入狀態已失效，請重新登入' };
  }

  let response: Response;
  try {
    response = await fetch(`/api/contest-info?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    return { parsed: null, sourceUrl: null, error: '連線失敗，請稍後再試' };
  }

  /*
    本機用 vite dev 跑的時候沒有這支函式，所有路徑都會回 index.html。
    直接 response.json() 會丟出看不懂的解析錯誤，先看內容型別擋掉。
  */
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {
      parsed: null,
      sourceUrl: null,
      error: '網址帶入要在正式站才能用，本機請改用「貼上文字」',
    };
  }

  const payload = (await response.json()) as {
    html?: string;
    source_url?: string;
    error?: string;
  };

  if (!response.ok || !payload.html) {
    return {
      parsed: null,
      sourceUrl: null,
      error: payload.error ?? '讀取失敗，請稍後再試',
    };
  }

  return {
    parsed: parseContestText(payload.html),
    sourceUrl: payload.source_url ?? url,
    error: null,
  };
}
