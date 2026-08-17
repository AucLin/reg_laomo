export interface ParsedContest {
  title: string | null;
  description: string | null;
  event_date: string | null;
  signup_deadline: string | null;
  location: string | null;
  /** 有沒有日期是「只寫月日、年份用推的」—— 這種一定要請人確認 */
  year_guessed: boolean;
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

/*
  只寫月日、不寫年份的日期。台灣的比賽公告裡「比賽日期：7/22、7/23」
  這種寫法比完整日期還常見，不支援等於大部分公告都抓不到日期。
  年份用推的，所以抓到之後一定要提醒人確認。

  前面那組 (^|[^\d]) 是為了不讓 168/2 這種數字的尾巴被當成月日；
  用它而不是回顧斷言，是因為舊一點的 Safari 不支援回顧斷言。
*/
const BARE_DATE_PATTERN = /(^|[^\d])(\d{1,2})\s*[/月]\s*(\d{1,2})(?!\d)/g;

interface FoundDate {
  iso: string;
  index: number;
  end: number;
  guessedYear: boolean;
}

/** 只有月日時推年份：已經過去超過一個月的，當成明年那一場 */
function guessYear(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  return candidate < monthAgo ? thisYear + 1 : thisYear;
}

function findDates(text: string, today: Date): FoundDate[] {
  const found: FoundDate[] = [];

  for (const match of text.matchAll(DATE_PATTERN)) {
    const iso = toIsoDate(match[1], match[2], match[3]);
    const index = match.index ?? 0;
    if (iso) found.push({ iso, index, end: index + match[0].length, guessedYear: false });
  }

  for (const match of text.matchAll(BARE_DATE_PATTERN)) {
    const index = (match.index ?? 0) + match[1].length;
    // 完整日期已經涵蓋的位置不要重複算，否則 2026/8/20 的「8/20」會再被撿一次
    if (found.some((item) => index >= item.index && index < item.end)) continue;

    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const iso = toIsoDate(String(guessYear(month, day, today)), match[2], match[3]);
    if (iso) {
      found.push({
        iso,
        index,
        end: index + match[0].length - match[1].length,
        guessedYear: true,
      });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/**
 * 找關鍵字附近最近的一個日期。
 *
 * 預設只看關鍵字後面 60 個字：公告的寫法是「比賽日期：115年8月20日」，
 * 再遠的日期多半屬於別的欄位，抓過來只會填錯。
 *
 * before 是給「日期寫在關鍵字前面」的寫法用的，例如
 * 「報名時間：5/25 起 至 6/18 23:59 截止」—— 這裡的截止日在「截止」
 * 這兩個字的左邊。
 */
function dateNearKeyword(
  text: string,
  keywords: string[],
  dates: FoundDate[],
  { after = 60, before = 0 } = {}
): FoundDate | null {
  for (const keyword of keywords) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(keyword, from);
      if (at === -1) break;

      if (after > 0) {
        const behind = dates.find(
          (item) => item.index >= at && item.index - at <= after
        );
        if (behind) return behind;
      }
      if (before > 0) {
        // 往前找要取最靠近關鍵字的那一個，所以從後面數過來
        const ahead = [...dates]
          .reverse()
          .find((item) => item.end <= at && at - item.end <= before);
        if (ahead) return ahead;
      }
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

/** 這一行是欄位而不是名稱，例如「比賽日期：7/22」 */
const FIELD_LABEL =
  /^(比賽|競賽|活動|賽事|報名|截止|收件|地點|場地|地址|日期|時間|名額|對象|費用|備註)/;

/*
  取第一行像樣的文字當比賽名稱。

  跳過兩種行：「● 北區」這類太短的小標題，以及「比賽日期：…」這類欄位 ——
  貼公告時常常從中間某一段開始選取，把欄位當成名稱帶進去，反而要多刪
  一次。都跳過就回 null，寧可空白讓人自己打。
*/
function firstMeaningfulLine(input: string): string | null {
  for (const line of input.split('\n')) {
    const cleaned = line
      .replace(/^[\s●○◆◇■□▲△★☆→▸•\-*]+/, '')
      // 條列編號才拿掉，「2026 WRO…」的年份要留著
      .replace(/^\d{1,2}\s*[.、)]\s*/, '')
      .trim();
    if (cleaned.length < 4) continue;
    if (FIELD_LABEL.test(cleaned)) continue;
    return cleaned.slice(0, 80);
  }
  return null;
}

function findLocation(text: string): string | null {
  const match = text.match(
    /(?:比賽地點|競賽地點|舉辦地點|活動地點|地點|場地|地址)\s*[:：]?\s*([^\n]{2,60})/
  );
  if (!match) return null;
  return match[1].replace(/\s{2,}/g, ' ').trim();
}

/*
  推年份是一個日期一個日期各自推的，於是會出現「比賽 7/22 推成今年、
  報名截止 6/18 推成明年」這種自相矛盾的組合 —— 截止日跑到比賽之後，
  存檔時還會被資料庫的檢查限制式擋下。

  截止日的年份既然是猜的，就讓它跟著比賽日期走：先試比賽那一年，還是
  比較晚就再往前一年。
*/
function alignDeadlineYear(
  deadline: FoundDate | null,
  event: FoundDate | null
): string | null {
  if (!deadline) return null;
  if (!event || !deadline.guessedYear || deadline.iso <= event.iso) {
    return deadline.iso;
  }

  const eventYear = Number(event.iso.slice(0, 4));
  const monthDay = deadline.iso.slice(4);
  const sameYear = `${eventYear}${monthDay}`;
  return sameYear <= event.iso ? sameYear : `${eventYear - 1}${monthDay}`;
}

/**
 * 從一段 HTML 或純文字裡把比賽資訊猜出來。
 *
 * 這是盡力而為，不是保證正確 —— 各家比賽官網的排版天差地遠。呼叫端
 * 一定要讓管理員看過再存。抓不到的欄位回 null，不亂填。
 */
export function parseContestText(
  input: string,
  today: Date = new Date()
): ParsedContest {
  const isHtml = looksLikeHtml(input);

  const title = isHtml
    ? metaContent(input, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i,
      ])
    : // 純文字就取開頭第一行像樣的當名稱：貼進來的公告幾乎都是標題起頭
      firstMeaningfulLine(input);

  const description = isHtml
    ? metaContent(input, [
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ])
    : null;

  const text = toPlainText(input);
  const dates = findDates(text, today);

  const event = dateNearKeyword(text, EVENT_KEYWORDS, dates);

  /*
    報名截止日有兩種寫法要抓：
    「報名截止：6/18」—— 日期在關鍵字後面
    「報名時間：5/25 起 至 6/18 23:59 截止」—— 日期在「截止」的前面
    後者在台灣的比賽公告裡很常見，只往後找會整個漏掉。
  */
  const deadline =
    dateNearKeyword(text, DEADLINE_KEYWORDS, dates) ??
    dateNearKeyword(text, ['截止'], dates, { after: 0, before: 40 });

  return {
    title,
    description,
    event_date: event?.iso ?? null,
    signup_deadline: alignDeadlineYear(deadline, event),
    location: findLocation(text),
    year_guessed: Boolean(event?.guessedYear || deadline?.guessedYear),
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

  const note = `已帶入：${filled.join('、')}。這是自動猜的，請逐項確認後再儲存。`;
  if (parsed.year_guessed) {
    return `${note}公告上的日期沒寫年份，年份是推出來的，請特別檢查。`;
  }
  return note;
}
