/**
 * 註冊時的信箱網域建議。
 *
 * 依台灣家長的使用比例排序，gmail 放第一個讓多數人按一下就完成。
 * 清單刻意維持精簡：選項一多，掃視成本就超過自己打完網域的成本。
 */
export const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com.tw',
  'hotmail.com',
  'icloud.com',
  'outlook.com',
  'msn.com',
];

/**
 * 依使用者當下輸入的文字，算出要顯示哪些完整信箱建議。
 *
 * 回傳空陣列代表「這時候不該出現建議清單」，呼叫端據此決定是否顯示。
 */
export function suggestEmails(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed === '') return [];

  const parts = trimmed.split('@');

  // 出現第二個小老鼠就已經不是合法信箱。這時給建議，等於把錯誤的
  // 輸入包裝成看起來正確的選項。
  if (parts.length > 2) return [];

  const [localPart, domainPart = ''] = parts;

  // 沒有帳號名稱的 "@gmail.com" 補完也不會變成有效信箱
  if (localPart === '') return [];

  // 網域比對不分大小寫（有些家長習慣開著大寫鎖定打信箱），
  // 但帳號部分一律保留使用者原本的大小寫 —— 某些信箱伺服器
  // 的帳號是區分大小寫的，擅自轉換會寄不到。
  const matched = COMMON_EMAIL_DOMAINS.filter((domain) =>
    domain.startsWith(domainPart.toLowerCase())
  );

  // 網域已經打完整時不再建議：清單只是加速輸入，跳一個一模一樣的
  // 選項出來只會擋住底下的送出按鈕。
  if (matched.length === 1 && matched[0] === domainPart.toLowerCase()) return [];

  return matched.map((domain) => `${localPart}@${domain}`);
}
