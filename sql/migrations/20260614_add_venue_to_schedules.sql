-- 移除 (user_id, schedule_date) 唯一限制，保留一天多場彈性
ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS menus_user_id_menu_date_key,
  DROP CONSTRAINT IF EXISTS schedules_user_id_schedule_date_key;

-- 新增巡迴場地欄位（全部 nullable，null = 一般店面行程）
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS venue_name    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS venue_start   TIME,
  ADD COLUMN IF NOT EXISTS venue_end     TIME,
  ADD CONSTRAINT IF NOT EXISTS schedules_venue_time_check
    CHECK (venue_start IS NULL OR venue_end IS NULL OR venue_start < venue_end);
