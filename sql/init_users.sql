-- 啟用隨機 UUID 函式（PostgreSQL 內建 pgcrypto 擴充）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 使用 UUID 作為使用者主鍵
CREATE TABLE
  IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW ()
  );

-- If users table already existed from an older schema, add missing columns safely.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 範例資料
INSERT INTO
  users (name, phone, email)
VALUES
  ('Alice', '123-456-7890', 'alice@example.com'),
  ('Bob', '987-654-3210', 'bob@example.com'),
  ('Charlie', '555-555-5555', 'charlie@example.com') ON CONFLICT (email) DO NOTHING;
