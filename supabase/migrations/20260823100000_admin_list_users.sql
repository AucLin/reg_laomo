/*
  後台要看得到家長的帳號名冊。

  profiles 存的是姓名、電話、角色，信箱不在裡面 —— 那是 auth.users 的
  欄位，而 auth 這個結構描述不開放給前端的 anon 金鑰查詢。可是信箱正是
  家長的登入身分，名冊少了它就對不起人：家長打電話來說「我登不進去」，
  行政人員手上要有那個信箱才查得下去。

  所以開一支 SECURITY DEFINER 函式跨過去讀。這類函式繞過列級權限，
  等於一道自己開的門，門後要自己站崗：

  1. 第一件事就是檢查 is_admin()，不是管理員直接丟例外。用 RAISE 而不是
     回空集合 —— 悄悄回空的話，日後誰把它接到家長端，畫面會顯示「目前
     沒有帳號」，沒有人會發現權限根本沒生效。
  2. search_path 寫死，避免有人在自己的結構描述裡放一張假的 profiles
     來騙過 is_admin()。
  3. 只收回這幾個欄位。auth.users 還有密碼雜湊、還原用的權杖那些東西，
     一個都不能跟著出來。

  不接搜尋參數：這間工作室四十個學生，帳號數量是幾十筆，一次撈完在前端
  過濾比每打一個字就往返一趟簡單得多，也不必煩惱關鍵字的跳脫處理。
*/

CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  role text,
  created_at timestamptz,
  email text,
  /* null 代表這個信箱還沒點過驗證信，那種帳號登不進來 */
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '沒有權限';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.full_name,
      p.phone,
      p.role,
      p.created_at,
      u.email::text,
      u.email_confirmed_at,
      u.last_sign_in_at
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

/*
  預設所有角色都能執行新函式，先全部收回再只發給登入者。沒登入的
  anon 連呼叫的機會都不該有 —— 函式裡雖然擋得住，但擋在門外更省事。
*/
REVOKE EXECUTE ON FUNCTION list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
