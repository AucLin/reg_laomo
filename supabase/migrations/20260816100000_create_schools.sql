/*
  建立全國學校名錄資料表

  資料來源：教育部統計處各級學校名錄（國小、國中、高中職）
  這張表是唯讀參考資料，只透過 scripts/import-schools.ts 維護，
  不開放任何網站使用者新增、修改或刪除。
*/

-- 模糊搜尋校名需要三連字元索引擴充套件
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('elementary', 'junior', 'senior')),
  city text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 依級別與縣市篩選是選擇器最常見的查詢
CREATE INDEX IF NOT EXISTS schools_level_city_idx ON schools (level, city);

-- 校名模糊比對（ILIKE '%關鍵字%'）需要三連字元索引才不會全表掃描
CREATE INDEX IF NOT EXISTS schools_name_trgm_idx ON schools USING gin (name gin_trgm_ops);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 所有人（含未登入訪客）都能查詢啟用中的學校
CREATE POLICY "任何人可查詢啟用中的學校"
  ON schools FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 刻意不建立 INSERT、UPDATE、DELETE 政策。
-- 啟用列級權限後沒有政策就等於全部拒絕，匯入腳本用 service_role 金鑰
-- 繞過列級權限寫入，這是唯一的寫入管道。
