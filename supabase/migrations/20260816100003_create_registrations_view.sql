/*
  報名查詢檢視表

  為什麼需要它：家長端與後台都要顯示「就讀學校」與依縣市篩選。若在前端用
  Supabase 的巢狀查詢 schools!inner 做，內連接會把 school_id 為 NULL 的報名
  （也就是「找不到我的學校」那批）整批濾掉 —— 而那正是唯一需要人工確認的
  一批，最不該消失。改用左連接的檢視表，學校欄位平鋪成一般欄位，篩選簡單，
  沒選到名錄學校的報名也一樣列得出來。

  security_invoker = true 讓檢視表以查詢者的身分套用底層資料表的列級權限。
  少了這個設定，檢視表會以建立者（超級使用者）的身分執行，等於在權限上開了
  一個後門，任何登入者都讀得到全部報名。
*/

CREATE OR REPLACE VIEW registrations_with_school
WITH (security_invoker = true) AS
SELECT
  r.*,
  s.name  AS school_name,
  s.city  AS school_city,
  s.level AS school_level
FROM registrations r
LEFT JOIN schools s ON s.id = r.school_id;
