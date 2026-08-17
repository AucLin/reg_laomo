/*
  建立學生資料表

  背景：學生資料原本直接寫在每一筆報名裡，所以「這個家長有哪幾個孩子」
  是答不出來的 —— 同一個孩子報了兩期課程，看起來就是兩筆長得很像的資料。
  比賽報名要能讓家長從自己的孩子裡挑一個，必須先有這張表。

  這張表存的是「現在」的狀況。報名紀錄上的年級與學校是各自的快照，
  兩者刻意不同步 —— 孩子升上六年級之後，去年那筆「國小五年級」的報名
  必須還是五年級，否則就是竄改歷史紀錄。
*/

/*
  年級代碼轉排序值：E1–E6 → 1–6、J1–J3 → 7–9、S1–S3 → 10–12。

  必須是 IMMUTABLE，contests 的參賽年級區間檢查限制式才用得了它
  （檢查限制式只接受不可變函式）。

  無法識別的代碼回 NULL 而不是丟例外：檢查限制式收到 NULL 會判定不成立，
  效果就是擋下來，比整個交易爆掉好。

  前端有一份等價實作（src/lib/types.ts 的 gradeRank），兩者必須一致。
  這一份是權威。
*/
CREATE OR REPLACE FUNCTION grade_rank(grade text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN grade ~ '^E[1-6]$' THEN substring(grade FROM 2)::int
    WHEN grade ~ '^J[1-3]$' THEN 6 + substring(grade FROM 2)::int
    WHEN grade ~ '^S[1-3]$' THEN 9 + substring(grade FROM 2)::int
    ELSE NULL
  END;
$$;

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  birthday date NOT NULL,

  -- 以下是「目前」的就學狀況，會隨升學、轉學而變動
  school_id uuid REFERENCES schools (id),
  school_name_raw text,
  grade text NOT NULL,
  class_name text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 與 registrations.school_required 同一套規則：學校要嘛選自名錄、
  -- 要嘛自由填寫，不能兩個都空
  CONSTRAINT students_school_required CHECK (
    school_id IS NOT NULL OR (school_name_raw IS NOT NULL AND school_name_raw <> '')
  ),

  /*
    年級格式檢查。registrations.grade 從來沒有這條限制，新表從一開始
    就擋住 —— 比賽的年級區間比對要靠格式正確才成立。

    這裡刻意用正規表示式而不是 grade_rank()，讓這張表不依賴函式的
    建立順序。
  */
  CONSTRAINT students_grade_valid CHECK (grade ~ '^(E[1-6]|J[1-3]|S[1-3])$')
);

CREATE INDEX IF NOT EXISTS students_parent_idx ON students (parent_id);

-- touch_updated_at() 已由 20260816100002_create_registrations.sql 建立
DROP TRIGGER IF EXISTS students_touch_updated_at ON students;
CREATE TRIGGER students_touch_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "家長可讀自己的孩子"
  ON students FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "管理員可讀全部孩子"
  ON students FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "家長可新增自己的孩子"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid());

/*
  WITH CHECK 這一句不可省：少了它，家長改得動 parent_id，
  等於把自己的孩子塞給別人的帳號。
*/
CREATE POLICY "家長可修改自己的孩子"
  ON students FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "家長可刪除自己的孩子"
  ON students FOR DELETE
  TO authenticated
  USING (parent_id = auth.uid());

/*
  刻意不給管理員 UPDATE 與 DELETE。孩子的資料是家長的，行政端要更正
  就打電話。這與「管理員不能改報名原文」是同一個責任歸屬原則。
*/

/*
  讀取用的檢視表，比照 registrations_with_school。
  security_invoker = true 讓列級權限照常生效 —— 少了它，這張檢視表
  就變成繞過權限讀別人孩子的後門。
*/
CREATE VIEW students_with_school
WITH (security_invoker = true) AS
SELECT
  st.*,
  s.name  AS school_name,
  s.city  AS school_city,
  s.level AS school_level
FROM students st
LEFT JOIN schools s ON s.id = st.school_id;
