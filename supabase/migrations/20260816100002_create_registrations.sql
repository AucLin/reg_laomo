/*
  建立報名資料表

  權限設計的核心原則：
  1. 家長只看得到自己的報名
  2. 管理員看得到全部，但只能改狀態與內部備註，不能改家長填的原始內容
  3. 家長只在「待審核」階段能改或撤回，一旦行政人員開始處理就凍結
*/

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- 學生資訊
  student_name text NOT NULL,
  student_gender text NOT NULL CHECK (student_gender IN ('male', 'female')),
  student_birthday date NOT NULL,
  school_id uuid REFERENCES schools (id),
  school_name_raw text,
  grade text NOT NULL,
  class_name text,

  -- 家長資訊
  parent_name text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('father', 'mother', 'grandparent', 'other')),
  contact_phone text NOT NULL,

  -- 行政欄位
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'enrolled', 'cancelled')),
  admin_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 學校要嘛選自名錄，要嘛填自由文字，不能兩個都沒有
  CONSTRAINT school_required CHECK (
    school_id IS NOT NULL OR (school_name_raw IS NOT NULL AND school_name_raw <> '')
  )
);

CREATE INDEX IF NOT EXISTS registrations_parent_idx ON registrations (parent_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations (status);
CREATE INDEX IF NOT EXISTS registrations_created_idx ON registrations (created_at DESC);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_touch_updated_at ON registrations;
CREATE TRIGGER registrations_touch_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- 家長只讀得到自己的報名
CREATE POLICY "家長可讀自己的報名"
  ON registrations FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

-- 管理員讀得到全部
CREATE POLICY "管理員可讀全部報名"
  ON registrations FOR SELECT
  TO authenticated
  USING (is_admin());

/*
  家長可新增報名，但 parent_id 必須是自己，且狀態必須是待審核。
  少了 parent_id 的檢查，任何人都能替別人送出報名。
*/
CREATE POLICY "家長可新增自己的報名"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = auth.uid() AND status = 'pending');

/*
  家長只在待審核階段可以修改，且改完必須仍是待審核 ——
  少了 WITH CHECK 的狀態限制，家長可以自己把報名改成「已錄取」。
*/
CREATE POLICY "家長可修改待審核的報名"
  ON registrations FOR UPDATE
  TO authenticated
  USING (parent_id = auth.uid() AND status = 'pending')
  WITH CHECK (parent_id = auth.uid() AND status = 'pending');

-- 家長只在待審核階段可以撤回
CREATE POLICY "家長可撤回待審核的報名"
  ON registrations FOR DELETE
  TO authenticated
  USING (parent_id = auth.uid() AND status = 'pending');

/*
  管理員的修改權限。

  列級權限沒有欄位層級的限制，所以「只能改狀態與備註」要另外用觸發器擋。
  單靠這條政策，管理員仍然改得動 student_name。
*/
CREATE POLICY "管理員可修改報名"
  ON registrations FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

/*
  凍結家長填寫的原始內容。

  管理員只能改 status 與 admin_note；其餘欄位一律維持原值。
  家長自己改自己的待審核報名不受此限。

  這條規則存在的理由是責任歸屬：日後對報名內容有爭議時，資料庫裡留的
  必須是家長當初送出的原文，不能被行政端事後修改。
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

  -- 其餘情況（即管理員修改）只准動 status 與 admin_note
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
  THEN
    RAISE EXCEPTION '不可修改家長填寫的報名內容，僅能變更狀態與內部備註';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_guard_fields ON registrations;
CREATE TRIGGER registrations_guard_fields
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION guard_registration_fields();
