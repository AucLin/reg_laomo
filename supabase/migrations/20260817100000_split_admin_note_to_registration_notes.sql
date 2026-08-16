/*
  把管理員內部備註拆到獨立資料表 registration_notes

  問題：admin_note 原本跟其他報名欄位放在同一張 registrations 表。
  列級權限（RLS）是「列」層級的規則，不是「欄位」層級 —— 家長對自己
  那筆報名本來就有 SELECT 權限，前端用 select('*') 查詢時 admin_note
  會跟著整包回來，前端沒把它印在畫面上不代表資料沒外洩：開發者工具
  一開，網路回應裡就看得到內容。guard_registration_fields 對「家長改
  自己待審核的報名」又是整段放行，家長甚至能自己往 admin_note 寫字，
  管理員看到的備註因此不保證出自行政端。

  唯一能真正兌現「家長看不到」這個承諾的做法，是把備註搬到獨立的表，
  只開放 is_admin() 的列級權限 —— 這樣即使有人自己用瀏覽器的 anon key
  構造請求直接查 registration_notes，也完全沒有任何政策放行，一筆都
  讀不到；不是只改前端不選這個欄位那種擋不住自己構造請求的做法。
*/

CREATE TABLE IF NOT EXISTS registration_notes (
  registration_id uuid PRIMARY KEY REFERENCES registrations (id) ON DELETE CASCADE,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 沿用 20260816100002 已建立的 touch_updated_at() 觸發器函式
DROP TRIGGER IF EXISTS registration_notes_touch_updated_at ON registration_notes;
CREATE TRIGGER registration_notes_touch_updated_at
  BEFORE UPDATE ON registration_notes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE registration_notes ENABLE ROW LEVEL SECURITY;

-- 只有管理員能讀寫。啟用 RLS 後沒有政策就等於全部拒絕 ——
-- 家長刻意不建立任何政策，這是設計，不是漏掉。
CREATE POLICY "管理員可讀備註"
  ON registration_notes FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "管理員可新增備註"
  ON registration_notes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "管理員可修改備註"
  ON registration_notes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "管理員可刪除備註"
  ON registration_notes FOR DELETE
  TO authenticated
  USING (is_admin());

-- 搬既有資料：只搬有內容的備註，避免灌一堆用不到的空列
INSERT INTO registration_notes (registration_id, note)
SELECT id, admin_note FROM registrations WHERE admin_note IS NOT NULL
ON CONFLICT (registration_id) DO NOTHING;

/*
  guard_registration_fields 的欄位保護清單本來就沒有把 admin_note
  列進去檢查（它跟 status 一樣是刻意開放給管理員的欄位），所以欄位
  拿掉後函式邏輯不必變。這裡用 CREATE OR REPLACE 只更新過時的註解與
  錯誤訊息 —— 原文說「僅能變更狀態與內部備註」，但 admin_note 已經
  搬離這張表，訊息不再準確。
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

  -- 其餘情況（即管理員修改）只准動 status；內部備註已搬到
  -- registration_notes，改備註是另一張表的 UPDATE，不受這個觸發器管轄
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
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION '不可修改家長填寫的報名內容，僅能變更狀態';
  END IF;

  RETURN NEW;
END;
$$;

/*
  資料已搬完，移除原本的欄位。

  registrations_with_school 檢視表用的是 SELECT r.*，PostgreSQL 因此把它
  記成「依賴 admin_note 欄位」，直接 DROP COLUMN 會被擋下
  （cannot drop column ... because other objects depend on it）。
  先整個 DROP 掉檢視表、拿掉欄位後再原樣重建 —— 重建的定義跟
  20260816100003_create_registrations_view.sql 建立時逐字相同，
  只是 r.* 少了 admin_note 這一欄，其餘結構（LEFT JOIN 學校表、
  security_invoker = true）完全不變。
*/
DROP VIEW IF EXISTS registrations_with_school;

ALTER TABLE registrations DROP COLUMN IF EXISTS admin_note;

CREATE VIEW registrations_with_school
WITH (security_invoker = true) AS
SELECT
  r.*,
  s.name  AS school_name,
  s.city  AS school_city,
  s.level AS school_level
FROM registrations r
LEFT JOIN schools s ON s.id = r.school_id;
