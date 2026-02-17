BEGIN;

CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  order_start_at TIMESTAMPTZ NOT NULL,
  order_end_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, menu_date),
  CONSTRAINT menus_status_check
    CHECK (status IN ('DRAFT', 'ANNOUNCED', 'OPEN', 'CLOSED', 'FULFILLED')),
  CONSTRAINT menus_order_time_check
    CHECK (order_start_at < order_end_at)
);

CREATE INDEX IF NOT EXISTS idx_menus_user_id_menu_date
  ON menus(user_id, menu_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_user_id_id_unique'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_user_id_id_unique UNIQUE (user_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  sales_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_id, product_id),
  CONSTRAINT menu_items_sales_limit_check
    CHECK (sales_limit IS NULL OR sales_limit > 0),
  CONSTRAINT menu_items_price_non_negative
    CHECK (unit_price >= 0),
  CONSTRAINT fk_menu_items_product_owner
    FOREIGN KEY (user_id, product_id)
    REFERENCES products(user_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id
  ON menu_items(menu_id);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'PLACED',
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  pickup_time TIMESTAMPTZ NOT NULL,
  note TEXT,
  payment_method VARCHAR(30) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_status_check
    CHECK (status IN ('PLACED', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT orders_total_amount_non_negative
    CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at
  ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_menu_id
  ON orders(menu_id);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT order_items_line_total_check CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id
  ON order_items(menu_item_id);

COMMIT;
