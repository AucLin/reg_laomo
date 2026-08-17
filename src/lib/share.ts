import { formatGrade, type Contest } from './types';

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
