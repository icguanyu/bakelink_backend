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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name),
  UNIQUE (user_id, category_id, name),
  CONSTRAINT fk_products_category_owner
    FOREIGN KEY (user_id, category_id)
    REFERENCES product_categories(user_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_categories_user_id ON product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

INSERT INTO product_categories (user_id, name)
SELECT u.id, v.category_name
FROM users u
JOIN (
  VALUES
    ('alice@example.com', '貝果'),
    ('alice@example.com', '吐司'),
    ('bob@example.com', '酸種')
) AS v(email, category_name)
  ON u.email = v.email
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO products (user_id, category_id, name)
SELECT c.user_id, c.id, v.product_name
FROM product_categories c
JOIN users u
  ON u.id = c.user_id
JOIN (
  VALUES
    ('alice@example.com', '貝果', '巧克力貝果'),
    ('alice@example.com', '吐司', '原味吐司'),
    ('bob@example.com', '酸種', '藍莓酸種')
) AS v(email, category_name, product_name)
  ON u.email = v.email
 AND c.name = v.category_name
ON CONFLICT (user_id, category_id, name) DO NOTHING;
