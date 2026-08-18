/*
  把家長打的校名整理成搜得到的樣子。

  這個系統存在的理由就是不要讓家長自己打校名 —— 打錯字、寫簡稱、多打
  縣市，每一種都會讓他搜不到，然後退回自由填寫，我們就收到一個歪掉的
  校名。所以搜尋這一端要盡量寬容。

  規則跟資料庫的 search_name 產生欄位必須一致（見
  supabase/migrations/20260821120000_add_school_search_name.sql）：
  那邊處理名錄的寫法，這邊處理家長的寫法。
*/

/** 名錄一律寫「臺」，家長幾乎都打「台」 */
function unifyTai(text: string): string {
  return text.replace(/臺/g, '台');
}

/*
  名錄用的是簡稱（「市立光復國小」，不是「國民小學」）。家長打全稱時
  換成簡稱才對得上。
*/
const FULL_TO_SHORT: [RegExp, string][] = [
  [/國民小學/g, '國小'],
  [/國民中學/g, '國中'],
  [/高級中等學校/g, '高中'],
  [/高級中學/g, '高中'],
  [/高級職業學校/g, '高職'],
  [/實驗國民小學/g, '實小'],
];

/*
  校名裡沒有縣市，那是獨立的欄位；家長卻很自然會打「台北市立光復國小」。
  只剝完整的縣市名（含「市」或「縣」），不剝「台中」這種兩個字的簡稱 ——
  「台中國小」剝掉就只剩「國小」，會搜出全部兩千多所國小。
*/
const CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣',
];

/** 剝完剩不到兩個字就不剝：「台北市」整串被吃掉會變成搜全部 */
const MIN_LENGTH_AFTER_STRIP = 2;

export function normalizeSchoolKeyword(input: string): string {
  let text = unifyTai(input).replace(/[\s　]/g, '');

  for (const [pattern, short] of FULL_TO_SHORT) {
    text = text.replace(pattern, short);
  }

  for (const city of CITIES) {
    if (text.startsWith(city) && text.length - city.length >= MIN_LENGTH_AFTER_STRIP) {
      text = text.slice(city.length);
      break;
    }
  }

  return text;
}
