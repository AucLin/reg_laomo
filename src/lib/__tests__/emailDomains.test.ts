import { describe, expect, it } from 'vitest';
import { COMMON_EMAIL_DOMAINS, suggestEmails } from '../emailDomains';

describe('suggestEmails', () => {
  it('還沒開始打字時不給建議', () => {
    expect(suggestEmails('')).toEqual([]);
    expect(suggestEmails('   ')).toEqual([]);
  });

  it('只打了帳號名稱時，列出所有常見網域', () => {
    const result = suggestEmails('mama0912');

    expect(result).toEqual(COMMON_EMAIL_DOMAINS.map((domain) => `mama0912@${domain}`));
  });

  it('打完小老鼠但還沒打網域時，一樣列出所有常見網域', () => {
    expect(suggestEmails('mama0912@')).toEqual(
      COMMON_EMAIL_DOMAINS.map((domain) => `mama0912@${domain}`)
    );
  });

  it('開始打網域後只留下開頭吻合的', () => {
    expect(suggestEmails('mama0912@g')).toEqual(['mama0912@gmail.com']);
  });

  it('比對網域時不分大小寫', () => {
    // 有些家長習慣開大寫鎖定打信箱
    expect(suggestEmails('MAMA0912@GM')).toEqual(['MAMA0912@gmail.com']);
  });

  it('網域已經打完整就不再建議', () => {
    // 清單只是加速輸入，打完了還跳一個一模一樣的選項只會擋住送出按鈕
    expect(suggestEmails('mama0912@gmail.com')).toEqual([]);
  });

  it('網域不在常見清單裡就不給建議', () => {
    // 公司或學校信箱，硬要推薦 gmail 只會干擾
    expect(suggestEmails('someone@example.org')).toEqual([]);
  });

  it('還沒打帳號名稱就不給建議', () => {
    // 只有 "@gmail.com" 不是有效信箱，補完也沒有意義
    expect(suggestEmails('@')).toEqual([]);
    expect(suggestEmails('@gmail.com')).toEqual([]);
  });

  it('出現第二個小老鼠時不給建議', () => {
    // 已經不是合法信箱，這時給建議會讓錯誤看起來像正確的
    expect(suggestEmails('a@b@')).toEqual([]);
    expect(suggestEmails('a@gmail.com@g')).toEqual([]);
  });

  it('保留使用者原本輸入的帳號大小寫', () => {
    // 信箱帳號部分在某些伺服器上是區分大小寫的，不能擅自轉小寫
    expect(suggestEmails('MaMa@g')).toEqual(['MaMa@gmail.com']);
  });

  it('前後空白不影響建議', () => {
    // 從別處複製貼上常常會帶到空白
    expect(suggestEmails('  mama@g  ')).toEqual(['mama@gmail.com']);
  });

  it('gmail.com 排在第一個', () => {
    // 家長用 gmail 的比例最高，放第一個讓大多數人按一下就完成
    expect(COMMON_EMAIL_DOMAINS[0]).toBe('gmail.com');
  });
});
