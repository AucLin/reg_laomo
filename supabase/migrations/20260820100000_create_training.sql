/*
  集訓：比賽報名之後的上課時段管理。

  場次綁在比賽底下，一場一場排（日期時間每次都不同，不是固定週期）。
  出缺席一場次一孩子一列，管理員現場點名，家長只能在場次開始前替自己的
  孩子請假 —— 老莫自己就是帶隊的人，不另外開老師角色。
*/

CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 結束早於開始的場次排不出來，讓資料庫直接擋掉
  CONSTRAINT training_sessions_time_order CHECK (end_time > start_time)
);

CREATE INDEX training_sessions_contest_idx
  ON training_sessions (contest_id, session_date, start_time);

/*
  出缺席。

  expected 只是「還沒點名」的意思，用不到獨立的狀態 —— 沒有列就代表
  還沒點名也沒請假，少一種狀態就少一次同步的負擔：新錄取的孩子不必
  回頭補建列，退出的孩子也不必清。
*/
CREATE TABLE training_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  -- 家長請假時填的原因。點名（present／absent）用不到
  leave_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_attendance_unique UNIQUE (session_id, entry_id)
);

CREATE INDEX training_attendance_session_idx
  ON training_attendance (session_id);

CREATE TRIGGER training_sessions_touch_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER training_attendance_touch_updated_at
  BEFORE UPDATE ON training_attendance
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;

-- 場次 --------------------------------------------------------------

/*
  家長只看得到自己孩子有份的比賽的場次。用 contest_entries 反查而不是
  開放整張表：沒報名的比賽開了幾梯集訓，不是家長該知道的事。
*/
CREATE POLICY "家長可讀自己孩子的集訓場次"
  ON training_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_entries
      WHERE contest_entries.contest_id = training_sessions.contest_id
        AND contest_entries.parent_id = auth.uid()
        AND contest_entries.status <> 'cancelled'
    )
  );

CREATE POLICY "管理員可讀全部集訓場次"
  ON training_sessions FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "管理員可新增集訓場次"
  ON training_sessions FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "管理員可修改集訓場次"
  ON training_sessions FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "管理員可刪除集訓場次"
  ON training_sessions FOR DELETE TO authenticated
  USING (is_admin());

-- 出缺席 ------------------------------------------------------------

CREATE POLICY "家長可讀自己孩子的出缺席"
  ON training_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_entries
      WHERE contest_entries.id = training_attendance.entry_id
        AND contest_entries.parent_id = auth.uid()
    )
  );

CREATE POLICY "管理員可讀全部出缺席"
  ON training_attendance FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "管理員可點名"
  ON training_attendance FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "管理員可改點名結果"
  ON training_attendance FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "管理員可清除點名結果"
  ON training_attendance FOR DELETE TO authenticated
  USING (is_admin());

/*
  家長請假走 request_leave() 這個 SECURITY DEFINER 函式，不開 INSERT
  政策給家長。

  理由跟報名比賽同一個：請假要同時滿足「這是我的孩子」「狀態只能是
  excused」「場次還沒開始」三個條件，寫成政策要三段 EXISTS，往後任何
  一段改錯就是家長改得動別人的出缺席。集中在一支函式裡，條件看得見、
  也擋得住直接打資料庫介面的人。
*/
CREATE OR REPLACE FUNCTION request_leave(
  p_session_id uuid,
  p_entry_id uuid,
  p_reason text
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

  -- 課都上完了才來請假沒有意義，紀錄也會失真
  IF (v_session.session_date + v_session.start_time) < now() THEN
    RAISE EXCEPTION '這個場次已經開始，請直接聯繫我們';
  END IF;

  /*
    已經被點過名就不給改。管理員標了「到」或「沒到」是現場的事實，
    家長事後按請假會把它蓋掉。
  */
  SELECT * INTO v_existing FROM training_attendance
   WHERE session_id = p_session_id AND entry_id = p_entry_id;

  IF FOUND AND v_existing.status <> 'excused' THEN
    RAISE EXCEPTION '這個場次已經點過名，請直接聯繫我們';
  END IF;

  INSERT INTO training_attendance (session_id, entry_id, status, leave_reason)
  VALUES (p_session_id, p_entry_id, 'excused', NULLIF(btrim(p_reason), ''))
  ON CONFLICT (session_id, entry_id)
  DO UPDATE SET status = 'excused',
                leave_reason = NULLIF(btrim(p_reason), '');
END;
$$;

/*
  取消請假：家長改變主意，孩子還是會來。同樣只能動自己孩子的、
  也只能刪掉自己按的請假，不能把管理員點的名清掉。
*/
CREATE OR REPLACE FUNCTION cancel_leave(
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
     AND a.status = 'excused'
     AND (s.session_date + s.start_time) >= now();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RAISE EXCEPTION '這筆請假已經無法取消，請直接聯繫我們';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION request_leave(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION cancel_leave(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION request_leave(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_leave(uuid, uuid) TO authenticated;
