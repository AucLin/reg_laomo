import {
  formatGrade,
  formatShortDate,
  formatTime,
  type Contest,
  type TrainingSession,
} from './types';

/**
 * 比賽的公開網址。家長不必登入就打得開（未登入時報名鈕會變成「登入後報名」）。
 *
 * origin 可以傳入是為了測試 —— 測試環境的 window.location.origin
 * 是 http://localhost:3000，寫死斷言會跟正式站不一致。
 */
export function contestUrl(
  contestId: string,
  origin: string = window.location.origin
): string {
  return `${origin}/contests/${contestId}`;
}

/**
 * 家長自己的報名頁。集訓時間表就在這一頁的最下面。
 *
 * 這一頁要登入才看得到，所以貼出去之前得確定收到的人是家長本人 ——
 * 貼進班級的 LINE 群組是預期的用法，貼到公開頁面沒有意義。
 */
export function myRegistrationsUrl(origin: string = window.location.origin): string {
  return `${origin}/my`;
}

/**
 * 排完集訓後貼到 LINE 群組的通知。
 *
 * 系統不會主動寄信 —— 這個補習班的家長本來就都在群組裡，貼一則訊息
 * 的到達率比信箱高得多。所以「發給家長」這件事就是產生這段文字，
 * 由老莫自己貼出去。
 *
 * sessions 傳進來的應該只有還沒上的場次：已經上完的寫進通知，家長
 * 會以為自己漏掉了什麼。
 */
export function buildTrainingNoticeText(
  contest: Contest,
  sessions: TrainingSession[],
  url: string
): string {
  // 沒有場次就沒有東西可通知。回空字串讓呼叫端把按鈕收起來，而不是
  // 產生一段家長點進去什麼都沒有的文案
  if (sessions.length === 0) return '';

  const lines = [`【${contest.title} 集訓時間】`];

  for (const session of sessions) {
    const time = `${formatTime(session.start_time)}-${formatTime(session.end_time)}`;
    /*
      備註寫的是「帶水壺」這種家長當天要知道的事，得跟著出現在通知裡。
      它在後台是多行輸入的，但 LINE 的訊息沒有縮排 —— 換行留著會讓
      後面幾行看起來像獨立的場次，所以壓成一行。
    */
    const note = (session.note ?? '')
      .split('\n')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .join(' ');

    lines.push(
      `${formatShortDate(session.session_date)}${time}${note === '' ? '' : ` ${note}`}`
    );
  }

  lines.push('', '請登入系統挑孩子要來的時段：', url);

  return lines.join('\n');
}

/**
 * 貼到 LINE 群組或臉書的文案。
 *
 * 名額只有在有上限時才寫出來 —— 「不限名額」寫進招生文案沒有意義，
 * 反而佔掉手機上一行。
 */
export function buildShareText(contest: Contest, url: string): string {
  const lines = [
    `【${contest.title}】`,
    `比賽日期：${contest.event_date}`,
    `地點：${contest.location}`,
    `報名截止：${contest.signup_deadline}`,
    `參賽年級：${formatGrade(contest.min_grade)}至${formatGrade(contest.max_grade)}`,
  ];

  if (contest.capacity !== null) {
    lines.push(`名額：${contest.capacity} 位`);
  }
  if (contest.description) {
    lines.push('', contest.description);
  }
  lines.push('', `線上報名：${url}`);

  return lines.join('\n');
}

/** LINE 的分享連結。行動裝置會直接開 LINE，桌機開網頁版 */
export function lineShareUrl(url: string, text: string): string {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
    url
  )}&text=${encodeURIComponent(text)}`;
}

/**
 * 臉書的分享連結。
 *
 * 臉書只吃網址，帶不了自訂文字（他們 2017 年起就忽略 quote 參數），
 * 預覽的標題與說明來自該頁的 Open Graph 標籤。所以文案要另外複製貼上。
 */
export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/**
 * 複製到剪貼簿。回傳是否成功 ——
 * 非安全連線（http）或使用者拒絕權限時 clipboard 會不存在或丟例外，
 * 呼叫端要能改顯示「請手動複製」而不是靜靜地什麼都沒發生。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
