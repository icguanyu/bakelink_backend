CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  ingredients TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_urls TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ingredient_details JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (user_id, id),
  UNIQUE (user_id, category_id, name),
  CONSTRAINT products_price_non_negative CHECK (price >= 0),
  CONSTRAINT fk_products_category_owner
    FOREIGN KEY (user_id, category_id)
    REFERENCES product_categories(user_id, id)
    ON DELETE CASCADE
);

ALTER TABLE products
  ALTER COLUMN price SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_categories_user_id ON product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

INSERT INTO product_categories (user_id, name)
SELECT u.id, v.category_name
FROM users u
JOIN (
  VALUES
    ('alice@example.com', 'Bagel'),
    ('alice@example.com', 'Sourdough'),
    ('bob@example.com', 'Cookie')
) AS v(email, category_name)
  ON u.email = v.email
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO products (user_id, category_id, name, price)
SELECT c.user_id, c.id, v.product_name, v.price
FROM product_categories c
JOIN users u
  ON u.id = c.user_id
JOIN (
  VALUES
    ('alice@example.com', 'Bagel', 'Chocolate Bagel', 80),
    ('alice@example.com', 'Sourdough', 'Country Sourdough', 95),
    ('bob@example.com', 'Cookie', 'Butter Cookie', 120)
) AS v(email, category_name, product_name, price)
  ON u.email = v.email
 AND c.name = v.category_name
ON CONFLICT (user_id, category_id, name) DO NOTHING;
