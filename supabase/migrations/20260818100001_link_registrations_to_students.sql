/*
  把既有報名裡的學生資料抽成 students，並建立關聯。

  registrations 的學生欄位刻意全部保留 —— 它們是報名送出當下的快照。
  孩子升上六年級之後，去年那筆「國小五年級」的報名必須還是五年級。
  後台顯示與 CSV 匯出一律以報名列上的快照為準，不去連結 students 取現值。
*/

/*
  遷移前先驗年級格式。

  students_grade_valid 是新加的限制，registrations.grade 從來沒有格式
  檢查。若舊資料有不合法的值，下面那段 INSERT 會整批失敗，而 PostgreSQL
  的錯誤訊息只會說違反檢查限制式，不會告訴你是哪一筆。
*/
DO $$
DECLARE
  v_bad int;
BEGIN
  SELECT count(*) INTO v_bad
  FROM registrations
  WHERE grade !~ '^(E[1-6]|J[1-3]|S[1-3])$';

  IF v_bad > 0 THEN
    RAISE EXCEPTION '有 % 筆報名的年級代碼格式不合法，請先人工修正後再執行遷移', v_bad;
  END IF;
END $$;

/*
  ON DELETE RESTRICT：有任何報名紀錄的孩子不能被刪除。

  先前考慮過 ON DELETE SET NULL（讓報名留著、只斷開關聯），但那會留下
  一批查不出是誰的孤兒報名，對行政端毫無用處。改成擋住刪除，前端在
  孩子有報名紀錄時不顯示刪除鈕。

  允許 NULL 是因為回填完成之前這一欄是空的；回填後由本檔尾端的驗證
  確保沒有殘留的 NULL。
*/
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS registrations_student_idx ON registrations (student_id);

/*
  抽出學生。

  同一個孩子報過多期課程會有多筆報名，用「家長 + 姓名 + 生日」判定是否
  同一人，取最新一筆的就學狀況當作目前狀態。

  這個判定不完美（同名同生日的雙胞胎會被合併成一個），但目前資料量是
  1 筆，且合併後家長在「我的孩子」看得到、可以自己補上第二個孩子。
  用更嚴格的判定反而會把同一個孩子拆成兩個 —— 那才是家長不會發現的錯誤。
*/
INSERT INTO students
  (parent_id, name, gender, birthday, school_id, school_name_raw, grade, class_name)
SELECT DISTINCT ON (parent_id, student_name, student_birthday)
  parent_id, student_name, student_gender, student_birthday,
  school_id, school_name_raw, grade, class_name
FROM registrations
ORDER BY parent_id, student_name, student_birthday, created_at DESC;

UPDATE registrations r
SET student_id = s.id
FROM students s
WHERE s.parent_id = r.parent_id
  AND s.name = r.student_name
  AND s.birthday = r.student_birthday
  AND r.student_id IS NULL;

/*
  檢視表必須整個 DROP 再重建，不能用 CREATE OR REPLACE VIEW。

  它的定義是 SELECT r.*，PostgreSQL 在建立當下就把 * 展開成固定的欄位
  清單。新增 student_id 之後重建，這一欄會出現在 school_name 之前 ——
  欄位順序變了，CREATE OR REPLACE VIEW 會直接拒絕。

  本專案在 20260817100000（拆 admin_note）已經踩過同一個坑。
  重建的定義與該檔第 117 行起完全相同。
*/
DROP VIEW IF EXISTS registrations_with_school;

CREATE VIEW registrations_with_school
WITH (security_invoker = true) AS
SELECT
  r.*,
  s.name  AS school_name,
  s.city  AS school_city,
  s.level AS school_level
FROM registrations r
LEFT JOIN schools s ON s.id = r.school_id;

/*
  欄位凍結觸發器加上 student_id。

  少了這一行，管理員可以把一筆報名改掛到別的孩子身上 —— 那等同於偽造
  報名紀錄的歸屬。整個函式沿用 20260816100002 的原始定義，只在判斷式
  尾端多一個欄位。
*/
CREATE OR REPLACE FUNCTION guard_registration_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 家長改自己的待審核報名，放行
  IF OLD.parent_id = auth.uid() AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- 其餘情況（即管理員修改）只准動 status
  IF NEW.student_name IS DISTINCT FROM OLD.student_name
     OR NEW.student_gender IS DISTINCT FROM OLD.student_gender
     OR NEW.student_birthday IS DISTINCT FROM OLD.student_birthday
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.school_name_raw IS DISTINCT FROM OLD.school_name_raw
     OR NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.class_name IS DISTINCT FROM OLD.class_name
     OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
     OR NEW.relation IS DISTINCT FROM OLD.relation
     OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
  THEN
    RAISE EXCEPTION '不可修改家長填寫的報名內容，僅能變更狀態與內部備註';
  END IF;

  RETURN NEW;
END;
$$;

/*
  回填驗證。不成立就讓整個遷移回滾 —— 帶著半套關聯上線，
  後面每一個功能都會踩到「有些報名查不到孩子」。
*/
DO $$
DECLARE
  v_orphan int;
BEGIN
  SELECT count(*) INTO v_orphan FROM registrations WHERE student_id IS NULL;
  IF v_orphan > 0 THEN
    RAISE EXCEPTION '有 % 筆報名沒有回填 student_id，遷移中止', v_orphan;
  END IF;
END $$;
