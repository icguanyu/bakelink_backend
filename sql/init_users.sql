CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  avatar TEXT,
  shop_name VARCHAR(100),
  owner_name VARCHAR(100),
  address TEXT,
  intro TEXT,
  order_pickup_time TIME,
  payment_methods TEXT[],
  pickup_methods TEXT[],
  shipping_free_threshold NUMERIC(12, 2),
  shipping_fee NUMERIC(12, 2),
  shipping_note TEXT,
  packaging_default_pack TEXT,
  packaging_pack_fee NUMERIC(12, 2),
  packaging_eco_discount NUMERIC(12, 2),
  packaging_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS owner_name VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS intro TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS order_pickup_time TIME;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_methods TEXT[];

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pickup_methods TEXT[];

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shipping_free_threshold NUMERIC(12, 2);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shipping_note TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS packaging_default_pack TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS packaging_pack_fee NUMERIC(12, 2);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS packaging_eco_discount NUMERIC(12, 2);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS packaging_note TEXT;

INSERT INTO users (name, phone, email, role)
VALUES
  ('Alice', '123-456-7890', 'alice@example.com', 'user'),
  ('Bob', '987-654-3210', 'bob@example.com', 'user'),
  ('Charlie', '555-555-5555', 'charlie@example.com', 'user')
ON CONFLICT (email) DO NOTHING;
