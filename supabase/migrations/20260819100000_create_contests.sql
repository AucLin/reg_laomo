/*
  比賽與比賽報名。

  grade_rank() 已於 20260818100000_create_students.sql 建立，這裡直接沿用
  ——年級代碼沒有排序性，區間比對要靠它換成對照值。
*/

CREATE TABLE IF NOT EXISTS contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  location text NOT NULL,
  signup_deadline date NOT NULL,

  -- NULL 代表不限名額
  capacity int CHECK (capacity IS NULL OR capacity > 0),

  min_grade text NOT NULL CHECK (min_grade ~ '^(E[1-6]|J[1-3]|S[1-3])$'),
  max_grade text NOT NULL CHECK (max_grade ~ '^(E[1-6]|J[1-3]|S[1-3])$'),

  /*
    draft   只有管理員看得到，可以隨意修改
    published 家長看得到，可以報名（仍要過截止日與名額檢查）
    closed  家長看得到但不能報名，用於已額滿或已結束的人工關閉
  */
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed')),

  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contests_grade_range
    CHECK (grade_rank(min_grade) <= grade_rank(max_grade)),
  CONSTRAINT contests_deadline_before_event
    CHECK (signup_deadline <= event_date)
);

CREATE INDEX IF NOT EXISTS contests_status_idx ON contests (status, event_date);

DROP TRIGGER IF EXISTS contests_touch_updated_at ON contests;
CREATE TRIGGER contests_touch_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE IF NOT EXISTS contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  -- 與 registrations.student_id 一致：有紀錄的孩子刪不掉
  student_id uuid NOT NULL REFERENCES students (id) ON DELETE RESTRICT,

  -- 冗餘欄位，但列級權限每次都要用到，不冗餘就得每次連結 students
  parent_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,

  -- 報名當下的快照：孩子升年級或改名之後，這一筆要維持原樣
  grade text NOT NULL,
  student_name text NOT NULL,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'enrolled', 'cancelled')),
  admin_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 同一個孩子同一場比賽只能有一筆
  CONSTRAINT contest_entries_unique UNIQUE (contest_id, student_id)
);

CREATE INDEX IF NOT EXISTS contest_entries_contest_idx
  ON contest_entries (contest_id, status);
CREATE INDEX IF NOT EXISTS contest_entries_parent_idx
  ON contest_entries (parent_id);

DROP TRIGGER IF EXISTS contest_entries_touch_updated_at ON contest_entries;
CREATE TRIGGER contest_entries_touch_updated_at
  BEFORE UPDATE ON contest_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 列級權限 ────────────────────────────────────────────────

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;

/*
  未登入的訪客也讀得到已發佈的比賽：進入頁要在未登入狀態顯示，這也是
  招生素材。草稿被 status IN ('published','closed') 的條件擋在外面。
*/
DROP POLICY IF EXISTS "任何人可讀已發佈的比賽" ON contests;
CREATE POLICY "任何人可讀已發佈的比賽" ON contests FOR SELECT
  TO anon, authenticated USING (status IN ('published', 'closed'));

DROP POLICY IF EXISTS "管理員可讀全部比賽" ON contests;
CREATE POLICY "管理員可讀全部比賽" ON contests FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "管理員可新增比賽" ON contests;
CREATE POLICY "管理員可新增比賽" ON contests FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "管理員可修改比賽" ON contests;
CREATE POLICY "管理員可修改比賽" ON contests FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "管理員可刪除比賽" ON contests;
CREATE POLICY "管理員可刪除比賽" ON contests FOR DELETE
  TO authenticated USING (is_admin());

ALTER TABLE contest_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "家長可讀自己的比賽報名" ON contest_entries;
CREATE POLICY "家長可讀自己的比賽報名" ON contest_entries FOR SELECT
  TO authenticated USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "管理員可讀全部比賽報名" ON contest_entries;
CREATE POLICY "管理員可讀全部比賽報名" ON contest_entries FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "管理員可修改比賽報名" ON contest_entries;
CREATE POLICY "管理員可修改比賽報名" ON contest_entries FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 家長只在待審核階段可以取消
DROP POLICY IF EXISTS "家長可取消待審核的比賽報名" ON contest_entries;
CREATE POLICY "家長可取消待審核的比賽報名" ON contest_entries FOR DELETE
  TO authenticated USING (parent_id = auth.uid() AND status = 'pending');

/*
  刻意沒有 INSERT 政策。新增報名一律走 enter_contest()，名額與資格檢查
  才無從繞過；前端直接 insert 會被列級權限擋下。
*/

-- ── 欄位凍結：管理員只准動 status 與 admin_note ──────────────

CREATE OR REPLACE FUNCTION guard_contest_entry_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  /*
    enter_contest() 復活被取消的報名時會改 grade 與 student_name（重新
    取當下的快照），那是這個函式本身的權責，用交易內旗標精準放行。
  */
  IF current_setting('app.reviving_contest_entry', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.contest_id IS DISTINCT FROM OLD.contest_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.student_name IS DISTINCT FROM OLD.student_name
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION '不可修改比賽報名的內容，僅能變更狀態與內部備註';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_entries_guard_fields ON contest_entries;
CREATE TRIGGER contest_entries_guard_fields
  BEFORE UPDATE ON contest_entries
  FOR EACH ROW EXECUTE FUNCTION guard_contest_entry_fields();

-- ── 報名：所有檢查都在這裡，前端繞不過去 ─────────────────────

CREATE OR REPLACE FUNCTION enter_contest(p_contest_id uuid, p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest contests%ROWTYPE;
  v_student students%ROWTYPE;
  v_taken int;
  v_entry_id uuid;
BEGIN
  -- 鎖住這場比賽。後到的請求在這一行等待，是整個函式的關鍵：
  -- 沒有這個鎖，兩位家長同時搶最後一個名額會兩筆都寫進去。
  SELECT * INTO v_contest FROM contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到這場比賽';
  END IF;

  /*
    SECURITY DEFINER 會繞過列級權限，所以這裡必須自己驗證呼叫者身分。
    少了這一段，任何人都能替別人的孩子報名。
  */
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND OR v_student.parent_id <> auth.uid() THEN
    RAISE EXCEPTION '這不是您的孩子';
  END IF;

  IF v_contest.status <> 'published' THEN
    RAISE EXCEPTION '這場比賽目前不開放報名';
  END IF;

  IF v_contest.signup_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION '報名已於 % 截止', v_contest.signup_deadline;
  END IF;

  IF grade_rank(v_student.grade) < grade_rank(v_contest.min_grade)
     OR grade_rank(v_student.grade) > grade_rank(v_contest.max_grade) THEN
    RAISE EXCEPTION '這場比賽的參賽年級不符';
  END IF;

  -- 已取消的報名要讓出名額
  SELECT count(*) INTO v_taken
  FROM contest_entries
  WHERE contest_id = p_contest_id AND status <> 'cancelled';

  IF v_contest.capacity IS NOT NULL AND v_taken >= v_contest.capacity THEN
    RAISE EXCEPTION '名額已滿';
  END IF;

  /*
    先前被取消的報名要能復活。

    唯一限制是 (contest_id, student_id)，被改成 cancelled 的那一列還在，
    直接 INSERT 會撞限制。但上面的名額計算已經把 cancelled 排除、名額也
    確實讓了出來 —— 不處理就會出現「有空位、原本那個孩子卻永遠報不進去」
    的死結。
  */
  PERFORM set_config('app.reviving_contest_entry', 'on', true);

  UPDATE contest_entries
  SET status = 'pending',
      grade = v_student.grade,
      student_name = v_student.name,
      admin_note = NULL
  WHERE contest_id = p_contest_id
    AND student_id = p_student_id
    AND status = 'cancelled'
  RETURNING id INTO v_entry_id;

  PERFORM set_config('app.reviving_contest_entry', 'off', true);

  IF v_entry_id IS NOT NULL THEN
    RETURN v_entry_id;
  END IF;

  INSERT INTO contest_entries
    (contest_id, student_id, parent_id, grade, student_name)
  VALUES
    (p_contest_id, p_student_id, auth.uid(), v_student.grade, v_student.name)
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
EXCEPTION
  /*
    走到這裡代表這個孩子已經有一筆非 cancelled 的報名 ——
    上面的 UPDATE 只撿 cancelled，撿不到就落到 INSERT 撞唯一限制。
  */
  WHEN unique_violation THEN
    RAISE EXCEPTION '這個孩子已經報名過這場比賽';
END;
$$;

/*
  SECURITY DEFINER 函式預設任何人都能執行。未登入時 auth.uid() 是 NULL、
  會走到「這不是您的孩子」而失敗，但明確收回權限是更穩的一層。
*/
REVOKE ALL ON FUNCTION enter_contest(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION enter_contest(uuid, uuid) TO authenticated;

/*
  已報名人數。不能用檢視表：專案慣例是給檢視表加 security_invoker，
  家長只讀得到自己的報名，用他的權限去數會得到「他自己報了幾筆」——
  20 人的比賽已報 12 個，家長會看到「已報 1 / 20」。

  改用 SECURITY DEFINER 只回一個數字。繞過列級權限是刻意的，外洩的
  只有一個彙總值，那正是比賽頁本來就要公開顯示的資訊。
*/
CREATE OR REPLACE FUNCTION contest_taken(p_contest_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::int
  FROM contest_entries
  WHERE contest_id = p_contest_id AND status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION contest_taken(uuid) FROM public;
GRANT EXECUTE ON FUNCTION contest_taken(uuid) TO anon, authenticated;
