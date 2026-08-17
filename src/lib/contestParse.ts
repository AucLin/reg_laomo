export interface ParsedContest {
  title: string | null;
  description: string | null;
  event_date: string | null;
  signup_deadline: string | null;
  location: string | null;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match])
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function looksLikeHtml(input: string): boolean {
  return /<\/?(html|head|body|div|p|table|meta|span|br)\b/i.test(input);
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const value = decodeEntities(match[1]).trim();
      if (value) return value;
    }
  }
  return null;
}

/** 把 HTML 攤成純文字。純文字丟進來也不會壞，只會順手收掉多餘空白 */
export function toPlainText(input: string): string {
  return decodeEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t　]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/*
  日期同時吃西元與民國。台灣的官方比賽公告很常寫「115年8月20日」，
  不轉換就會存成西元 115 年。
*/
const DATE_PATTERN = /(\d{2,4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/g;

function toIsoDate(yearRaw: string, monthRaw: string, dayRaw: string): string | null {
  let year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  // 四位數以下一律當民國年
  if (year < 1000) year += 1911;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface FoundDate {
  iso: string;
  index: number;
}

function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  for (const match of text.matchAll(DATE_PATTERN)) {
    const iso = toIsoDate(match[1], match[2], match[3]);
    if (iso) found.push({ iso, index: match.index ?? 0 });
  }
  return found;
}

/**
 * 找關鍵字後面最近的一個日期。
 *
 * 只看關鍵字後面 60 個字：比賽公告的寫法是「比賽日期：115年8月20日」，
 * 再遠的日期多半屬於別的欄位，抓過來只會填錯。
 */
function dateNearKeyword(
  text: string,
  keywords: string[],
  dates: FoundDate[]
): string | null {
  for (const keyword of keywords) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(keyword, from);
      if (at === -1) break;
      const near = dates.find((item) => item.index >= at && item.index - at <= 60);
      if (near) return near.iso;
      from = at + keyword.length;
    }
  }
  return null;
}

const EVENT_KEYWORDS = [
  '比賽日期',
  '競賽日期',
  '活動日期',
  '賽事日期',
  '比賽時間',
  '活動時間',
  '競賽時間',
];

const DEADLINE_KEYWORDS = [
  '報名截止',
  '截止日期',
  '報名期限',
  '收件截止',
  '報名日期',
  '報名時間',
];

function findLocation(text: string): string | null {
  const match = text.match(
    /(?:比賽地點|競賽地點|舉辦地點|活動地點|地點|場地|地址)\s*[:：]?\s*([^\n]{2,60})/
  );
  if (!match) return null;
  return match[1].replace(/\s{2,}/g, ' ').trim();
}

/**
 * 從一段 HTML 或純文字裡把比賽資訊猜出來。
 *
 * 這是盡力而為，不是保證正確 —— 各家比賽官網的排版天差地遠。呼叫端
 * 一定要讓管理員看過再存。抓不到的欄位回 null，不亂填。
 */
export function parseContestText(input: string): ParsedContest {
  const isHtml = looksLikeHtml(input);

  const title = isHtml
    ? metaContent(input, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i,
      ])
    : // 純文字就取第一行當名稱：貼進來的公告幾乎都是標題起頭
      (input.trim().split('\n')[0] ?? '').trim().slice(0, 80) || null;

  const description = isHtml
    ? metaContent(input, [
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ])
    : null;

  const text = toPlainText(input);
  const dates = findDates(text);

  return {
    title,
    description,
    event_date: dateNearKeyword(text, EVENT_KEYWORDS, dates),
    signup_deadline: dateNearKeyword(text, DEADLINE_KEYWORDS, dates),
    location: findLocation(text),
  };
}

/** 整理成「帶入了哪些」的說明，讓管理員知道要檢查什麼 */
export function describeParsed(parsed: ParsedContest): string {
  const filled: string[] = [];
  if (parsed.title) filled.push('名稱');
  if (parsed.event_date) filled.push('比賽日期');
  if (parsed.signup_deadline) filled.push('報名截止日');
  if (parsed.location) filled.push('地點');
  if (parsed.description) filled.push('說明');

  if (filled.length === 0) {
    return '抓不到可用的欄位，請手動填寫。';
  }
  return `已帶入：${filled.join('、')}。這是自動猜的，請逐項確認後再儲存。`;
}
