/*
  集訓改成「家長挑時段」，不再是「全員必到、要缺席就請假」。

  原本的設計預設每個錄取的孩子每一場都會到，家長要不來就按請假。實際的
  運作方式相反：管理員先把時間表排出來，家長從裡面挑孩子要上的時段，
  管理員因此在開課前就知道每個時段會有誰。

  兩者差在預設值，而預設值決定了資料的意義：舊模型「沒有列」代表會來，
  新模型「沒有列」代表不來。所以狀態集合要跟著換：

  - signed_up：家長挑了這個時段，人會來
  - present／absent：上課當天管理員點的名

  excused（請假）整個拿掉 —— 沒挑就是不來，不需要另外一種「有挑但不來」。
  家長改變主意就取消挑選，那是刪掉列，不是換一個狀態。

  出缺席表目前是空的（比賽還沒真的開跑），所以直接換掉檢查限制式，
  沒有既有資料要轉換。leave_reason 一併移除：請假理由在新模型裡沒有
  對應的動作，留著只會讓人以為還能請假。
*/

ALTER TABLE training_attendance
  DROP CONSTRAINT training_attendance_status_check,
  ADD CONSTRAINT training_attendance_status_check
    CHECK (status IN ('signed_up', 'present', 'absent'));

ALTER TABLE training_attendance DROP COLUMN leave_reason;

-- 舊的請假函式連同它們的權限一起消失
DROP FUNCTION IF EXISTS request_leave(uuid, uuid, text);
DROP FUNCTION IF EXISTS cancel_leave(uuid, uuid);

/*
  家長挑時段。

  跟舊的請假函式同一個理由不開 INSERT 政策給家長：要同時滿足「這是我的
  孩子」「這個孩子錄取了這場比賽」「狀態只能是 signed_up」「場次還沒
  開始」四個條件，寫成政策是四段 EXISTS，往後改錯任何一段就是家長動得了
  別人的紀錄。集中在一支函式裡，條件看得見，也擋得住直接打資料庫介面的人。
*/
CREATE OR REPLACE FUNCTION signup_training(
  p_session_id uuid,
  p_entry_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session training_sessions;
  v_entry contest_entries;
  v_existing training_attendance;
BEGIN
  SELECT * INTO v_session FROM training_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到這個集訓場次';
  END IF;

  SELECT * INTO v_entry FROM contest_entries WHERE id = p_entry_id;
  IF NOT FOUND OR v_entry.parent_id <> auth.uid() THEN
    RAISE EXCEPTION '這不是您的孩子';
  END IF;

  IF v_entry.contest_id <> v_session.contest_id THEN
    RAISE EXCEPTION '這個孩子沒有報名這場比賽';
  END IF;

  -- 集訓是給錄取的孩子上的。還在審核或已取消的報名挑不了時段
  IF v_entry.status <> 'enrolled' THEN
    RAISE EXCEPTION '這個孩子還沒錄取這場比賽';
  END IF;

  -- 課都開始了才來挑沒有意義，管理員也早就照著名單準備了
  IF (v_session.session_date + v_session.start_time) < now() THEN
    RAISE EXCEPTION '這個場次已經開始，請直接聯繫我們';
  END IF;

  /*
    已經被點過名就不給動。管理員標了「到」或「沒到」是現場的事實，
    家長事後再按會把它蓋掉。
  */
  SELECT * INTO v_existing FROM training_attendance
   WHERE session_id = p_session_id AND entry_id = p_entry_id;

  IF FOUND AND v_existing.status <> 'signed_up' THEN
    RAISE EXCEPTION '這個場次已經點過名，請直接聯繫我們';
  END IF;

  -- 重複按當成成功：家長連點兩下不該看到錯誤訊息
  INSERT INTO training_attendance (session_id, entry_id, status)
  VALUES (p_session_id, p_entry_id, 'signed_up')
  ON CONFLICT (session_id, entry_id) DO NOTHING;
END;
$$;

/*
  取消挑選。只動得了自己孩子的、也只刪得掉自己挑的那一列 ——
  管理員點過的名清不掉。
*/
CREATE OR REPLACE FUNCTION cancel_training_signup(
  p_session_id uuid,
  p_entry_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM training_attendance a
   USING contest_entries e, training_sessions s
   WHERE a.session_id = p_session_id
     AND a.entry_id = p_entry_id
     AND e.id = a.entry_id
     AND e.parent_id = auth.uid()
     AND s.id = a.session_id
     AND a.status = 'signed_up'
     AND (s.session_date + s.start_time) >= now();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RAISE EXCEPTION '這個時段已經不能取消，請直接聯繫我們';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION signup_training(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION cancel_training_signup(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION signup_training(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_training_signup(uuid, uuid) TO authenticated;
