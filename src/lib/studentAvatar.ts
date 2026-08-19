/*
  孩子清單上的頭像。

  同一個家長的孩子常常同姓，名字又只差一個字（「宥宇」「宥辰」），
  整排卡片長得一模一樣時，家長得逐字讀完才分得出誰是誰。給每個孩子
  一個固定的字加一個固定的顏色，眼睛掃過去先認出色塊，不必讀字。
*/

/** 只有半形可見字元的名字（英文名、代號）走另一套取字規則 */
const ASCII_ONLY = /^[\x20-\x7E]+$/;

/**
 * 頭像上顯示的字。
 *
 * 中文名取名不取姓 —— 兄弟姊妹的姓一定一樣，取姓等於沒取。
 * 拉丁字母的名字反過來取前兩個字母，那才是叫得出來的部分。
 */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') return '？';
  if (ASCII_ONLY.test(trimmed)) return trimmed.slice(0, 2).toUpperCase();

  // 用展開運算子而不是 slice：emoji 與罕用字是兩個碼元，切一半會變亂碼
  const letters = [...trimmed];
  return (letters.length >= 3 ? letters.slice(-2) : letters.slice(-1)).join('');
}

/*
  五個色相刻意拉開，不用同一家族的深淺 —— 淡藍配天藍在手機上就是同一
  塊顏色，多兩個選項反而讓相鄰的兩張卡片更難分。寧可顏色少、每個都
  一眼認得出是哪個顏色。
*/
const TONES = [
  'bg-brand-200 text-brand-900',
  'bg-amber-200 text-amber-900',
  'bg-emerald-200 text-emerald-900',
  'bg-rose-200 text-rose-900',
  'bg-violet-200 text-violet-900',
];

/**
 * 頭像底色，由名字決定。
 *
 * 刻意不用排列位置決定 —— 那樣新增一個孩子就會讓前面每個人的顏色
 * 全部換一輪，家長好不容易記住的色塊就白記了。
 */
export function avatarTone(name: string): string {
  let sum = 0;
  for (const letter of name) sum += letter.codePointAt(0) ?? 0;
  return TONES[sum % TONES.length];
}
