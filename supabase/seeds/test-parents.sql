/*
  測試用的家長名單，用來在後台看集訓報名的人數分佈。

  這些帳號「沒有密碼」，登不進去 —— 建出來只是為了讓管理員頁面有
  東西可看。要真的以家長身分登入測試，請在 Supabase 後台自己給某個
  帳號設密碼。

  只動「WRO 2026 test」這場比賽，不碰正式那場。可以重複執行：每次
  會先把上一批清掉再建。

  執行：
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" \
      -v ON_ERROR_STOP=1 -f supabase/seeds/test-parents.sql

  清乾淨（連場次一起）：
    見檔尾的清理區段。
*/

BEGIN;

-- 上一批先清掉。auth.users 往下 CASCADE 到 profiles → students /
-- contest_entries → training_attendance，一路刪乾淨
DELETE FROM auth.users WHERE email LIKE 'test-parent-%@example.invalid';

-- 這一批要用到的場次也重排，人數分佈才對得上
DELETE FROM training_sessions
WHERE contest_id = (SELECT id FROM contests WHERE title = 'WRO 2026 test')
  AND session_date > '2026-08-20';

-- ── 家長與孩子 ──────────────────────────────────────────────
CREATE TEMP TABLE seed_people AS
SELECT
  n,
  gen_random_uuid() AS parent_id,
  gen_random_uuid() AS student_id,
  format('test-parent-%s@example.invalid', lpad(n::text, 2, '0')) AS email,
  format('測試家長%s', lpad(n::text, 2, '0')) AS parent_name,
  format('測試學生%s', lpad(n::text, 2, '0')) AS student_name,
  format('09000000%s', lpad(n::text, 2, '0')) AS phone
FROM generate_series(1, 10) AS n;

INSERT INTO auth.users (id, email)
SELECT parent_id, email FROM seed_people;

-- 建立 auth.users 時有觸發器會自動補一列 profiles，所以這裡是覆寫姓名與電話
INSERT INTO profiles (id, full_name, phone, role)
SELECT parent_id, parent_name, phone, 'parent' FROM seed_people
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role;

-- 學校用 school_name_raw，不去碰 schools 的名錄
INSERT INTO students (id, parent_id, name, gender, birthday, school_name_raw, grade)
SELECT
  student_id,
  parent_id,
  student_name,
  CASE WHEN n % 2 = 0 THEN 'female' ELSE 'male' END,
  '2016-01-01'::date,
  '測試國小',
  'E4'
FROM seed_people;

INSERT INTO contest_entries (contest_id, student_id, parent_id, grade, student_name, status)
SELECT
  (SELECT id FROM contests WHERE title = 'WRO 2026 test'),
  student_id,
  parent_id,
  'E4',
  student_name,
  'enrolled'
FROM seed_people;

-- ── 集訓場次 ────────────────────────────────────────────────
INSERT INTO training_sessions (contest_id, session_date, start_time, end_time, note)
SELECT
  (SELECT id FROM contests WHERE title = 'WRO 2026 test'),
  d::date,
  '14:00'::time,
  '17:00'::time,
  note
FROM (VALUES
  ('2026-08-21', NULL),
  ('2026-08-24', '帶主機與電池'),
  ('2026-08-26', NULL),
  ('2026-08-28', NULL)
) AS s(d, note);

-- ── 誰挑了哪一場 ────────────────────────────────────────────
/*
  人數刻意排得有多有少：8/21 只有 2 人、8/26 一個都沒有，那兩場才
  會在後台標成「人偏少」。8/18 是已經上完的那場，混一些沒到的。
*/
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY student_name) AS rn
  FROM contest_entries
  WHERE contest_id = (SELECT id FROM contests WHERE title = 'WRO 2026 test')
    AND student_name LIKE '測試學生%'
),
plan AS (
  SELECT s.id AS session_id, p.n, s.session_date
  FROM training_sessions s
  JOIN (VALUES
    ('2026-08-18'::date, '13:00'::time, 5),
    ('2026-08-20', '13:00', 9),
    ('2026-08-20', '16:00', 6),
    ('2026-08-21', '14:00', 2),
    ('2026-08-24', '14:00', 7),
    ('2026-08-26', '14:00', 0),
    ('2026-08-28', '14:00', 4)
  ) AS p(d, t, n) ON s.session_date = p.d AND s.start_time = p.t
  WHERE s.contest_id = (SELECT id FROM contests WHERE title = 'WRO 2026 test')
)
INSERT INTO training_attendance (session_id, entry_id, status)
SELECT
  plan.session_id,
  ranked.id,
  -- 已經上完的那場點過名了，其餘就只是家長挑了時段
  CASE
    WHEN plan.session_date < CURRENT_DATE THEN
      CASE WHEN ranked.rn % 4 = 0 THEN 'absent' ELSE 'present' END
    ELSE 'signed_up'
  END
FROM plan
JOIN ranked ON ranked.rn <= plan.n;

DROP TABLE seed_people;

COMMIT;

/*
  ── 清理 ────────────────────────────────────────────────────
  刪掉這批測試家長（連孩子、報名、挑選紀錄一起）：

    DELETE FROM auth.users WHERE email LIKE 'test-parent-%@example.invalid';

  連這支腳本加排的集訓場次也刪掉：

    DELETE FROM training_sessions
    WHERE contest_id = (SELECT id FROM contests WHERE title = 'WRO 2026 test')
      AND session_date > '2026-08-20';
*/
