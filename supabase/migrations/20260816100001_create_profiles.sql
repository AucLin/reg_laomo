/*
  建立使用者資料表與管理員判定函式

  profiles 與 Supabase Auth 的使用者一對一，註冊時由觸發器自動建立，
  前端不需要（也不應該）自己新增。
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

/*
  管理員判定函式。

  為什麼要包成函式：profiles 的權限政策需要查 profiles 自己的 role 欄位，
  直接在政策裡寫子查詢會讓政策查詢觸發政策，造成無窮遞迴而報錯。
  用 security definer 讓函式以擁有者身分執行、跳過列級權限，就切斷了迴圈。

  search_path 必須明確設定，否則呼叫端可以偽造一個同名的 profiles 資料表
  騙過這個函式取得管理員權限。
*/
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 本人可讀自己的資料
CREATE POLICY "使用者可讀自己的資料"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 管理員可讀全部
CREATE POLICY "管理員可讀全部使用者資料"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

/*
  本人可改自己的姓名與電話，但不可改 role。

  USING 決定哪些列可以被更新，WITH CHECK 決定更新後的內容是否合法。
  這裡 WITH CHECK 額外要求 role 必須維持原值 —— 少了這一句，家長就能
  把自己升級成管理員。
*/
CREATE POLICY "使用者可改自己的姓名與電話"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- 管理員可修改任何人的資料（含指派管理員身分）
CREATE POLICY "管理員可修改使用者資料"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 不建立 INSERT 政策：資料列一律由下方觸發器建立
-- 不建立 DELETE 政策：帳號刪除走 Supabase Auth，由外鍵連動刪除

/*
  註冊時自動建立 profiles 資料列。

  姓名與電話從註冊時傳入的 metadata 取得。若前端漏傳，用空字串墊著也不
  讓註冊失敗 —— 帳號建起來了卻沒有 profiles，使用者會卡在一個無法修復的
  狀態，比欄位空白嚴重得多。
*/
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
