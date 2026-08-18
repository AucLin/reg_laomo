/*
  學校搜尋用的正規化欄位。

  家長選不到學校，主因不是名錄缺學校，是打的字跟名錄對不起來：

  1. 名錄一律寫「臺」，家長幾乎都打「台」。打「台北教大實小」找不到
     「國立臺北教大實小」。
  2. 校名裡沒有縣市（名錄是「市立光復國小」，縣市在 city 欄位），
     家長卻很自然會打「台北市立光復國小」。

  這裡處理名錄那一端：把「臺」正規化成「台」、去掉空白，存成 search_name
  讓搜尋比對它而不是 name。畫面上顯示的仍然是 name 的正式寫法 ——
  正規化只是為了讓家長打得中，不是要改校名。

  家長輸入那一端在 src/lib/schools.ts 的 normalizeSchoolKeyword() 做同樣
  的正規化，另外再剝掉開頭的縣市名。兩邊的規則必須一致。

  用產生欄位而不是查詢時即時 replace()：即時算的話 trigram 索引用不上，
  三千多筆每次全表掃描。
*/

ALTER TABLE schools
  ADD COLUMN search_name text
  GENERATED ALWAYS AS (
    replace(replace(replace(name, '臺', '台'), ' ', ''), '　', '')
  ) STORED;

CREATE INDEX schools_search_name_trgm_idx
  ON schools USING gin (search_name gin_trgm_ops);
