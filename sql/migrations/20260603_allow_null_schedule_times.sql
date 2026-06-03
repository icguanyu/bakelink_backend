-- Allow NULL for order_start_at / order_end_at
-- These fields are only meaningful when status = 'OPEN'
ALTER TABLE schedules
  ALTER COLUMN order_start_at DROP NOT NULL,
  ALTER COLUMN order_end_at   DROP NOT NULL;
