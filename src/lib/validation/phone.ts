/**
 * 驗證臺灣電話號碼，同時接受手機與市話，連字號可有可無。
 *   手機：09 開頭共 10 碼
 *   市話：區碼 2 到 3 碼（0 開頭）加 6 到 8 碼號碼
 */
export function isValidTaiwanPhone(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');

  if (!/^\d+$/.test(digits)) return false;

  const mobile = /^09\d{8}$/;
  const landline = /^0\d{1,2}\d{6,8}$/;

  return mobile.test(digits) || landline.test(digits);
}
