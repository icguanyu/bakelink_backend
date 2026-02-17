BEGIN;

DO $$
BEGIN
  IF to_regclass('public.menus') IS NOT NULL
     AND to_regclass('public.schedules') IS NULL THEN
    ALTER TABLE menus RENAME TO schedules;
  END IF;

  IF to_regclass('public.menu_items') IS NOT NULL
     AND to_regclass('public.schedule_items') IS NULL THEN
    ALTER TABLE menu_items RENAME TO schedule_items;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schedules'
      AND column_name = 'menu_date'
  ) THEN
    ALTER TABLE schedules RENAME COLUMN menu_date TO schedule_date;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schedule_items'
      AND column_name = 'menu_id'
  ) THEN
    ALTER TABLE schedule_items RENAME COLUMN menu_id TO schedule_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'menu_id'
  ) THEN
    ALTER TABLE orders RENAME COLUMN menu_id TO schedule_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_items'
      AND column_name = 'menu_item_id'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN menu_item_id TO schedule_item_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedules_user_id_schedule_date
  ON schedules(user_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule_id
  ON schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_orders_schedule_id
  ON orders(schedule_id);
CREATE INDEX IF NOT EXISTS idx_order_items_schedule_item_id
  ON order_items(schedule_item_id);

COMMIT;
