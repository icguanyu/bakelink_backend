const { pool } = require("../db");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");

function normalizeProductPayload(body = {}) {
  const { name, category_id, price } = body;
  if (!name || !String(name).trim() || !category_id) {
    return { error: "name and category_id are required" };
  }

  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return { error: "price must be a non-negative number" };
  }

  const description =
    body.description == null ? null : String(body.description).trim();
  const ingredients =
    body.ingredients == null ? null : String(body.ingredients).trim();

  const isActiveRaw = body.is_active;
  let isActive = true;
  if (isActiveRaw != null) {
    if (typeof isActiveRaw !== "boolean") {
      return { error: "is_active must be a boolean" };
    }
    isActive = isActiveRaw;
  }

  const imageUrlsRaw = body.image_urls;
  let imageUrls = [];
  if (imageUrlsRaw != null) {
    if (!Array.isArray(imageUrlsRaw)) {
      return { error: "image_urls must be an array of strings" };
    }
    imageUrls = imageUrlsRaw.map((url) => String(url || "").trim());
    if (imageUrls.some((url) => !url)) {
      return { error: "image_urls cannot contain empty values" };
    }
  }

  const ingredientDetailsRaw = body.ingredient_details;
  let ingredientDetails = [];
  if (ingredientDetailsRaw != null) {
    if (!Array.isArray(ingredientDetailsRaw)) {
      return { error: "ingredient_details must be an array" };
    }

    ingredientDetails = ingredientDetailsRaw.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { __invalid: "each ingredient_details item must be an object" };
      }

      const detailName = String(item.name || "").trim();
      const gramsNum = Number(item.grams);
      const isVisible = item.is_visible;

      if (!detailName) {
        return { __invalid: "ingredient detail name is required" };
      }
      if (!Number.isFinite(gramsNum) || gramsNum < 0) {
        return { __invalid: "ingredient detail grams must be non-negative" };
      }
      if (typeof isVisible !== "boolean") {
        return { __invalid: "ingredient detail is_visible must be boolean" };
      }

      return {
        name: detailName,
        grams: gramsNum,
        is_visible: isVisible,
      };
    });

    const invalidItem = ingredientDetails.find((item) => item.__invalid);
    if (invalidItem) {
      return { error: invalidItem.__invalid };
    }
  }

  return {
    value: {
      name: String(name).trim(),
      category_id,
      price: priceNum,
      description,
      ingredients,
      is_active: isActive,
      image_urls: imageUrls,
      ingredient_details: ingredientDetails,
    },
  };
}

async function list(req, res) {
  try {
    const source = req.method === "POST" ? req.body || {} : req.query;
    const { hasPagination, page, limit, offset } = resolvePagination(source);
    const keyword = String(source.keyword || "").trim();
    const keywordPattern = `%${keyword}%`;
    const categoryId = source.category_id || null;

    let total = 0;
    let result;

    if (hasPagination) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM products p
         JOIN product_categories c
           ON c.id = p.category_id AND c.user_id = p.user_id
         WHERE p.user_id = $1
           AND ($2 = '' OR p.name ILIKE $3 OR c.name ILIKE $3)
           AND ($4::uuid IS NULL OR p.category_id = $4)`,
        [req.user.sub, keyword, keywordPattern, categoryId],
      );
      total = countResult.rows[0]?.total || 0;

      result = await pool.query(
        `SELECT p.id, p.category_id, c.name AS category_name,
                p.name, p.price, p.description, p.ingredients, p.is_active,
                CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url,
                p.ingredient_details
         FROM products p
         JOIN product_categories c
           ON c.id = p.category_id AND c.user_id = p.user_id
         WHERE p.user_id = $1
           AND ($2 = '' OR p.name ILIKE $3 OR c.name ILIKE $3)
           AND ($4::uuid IS NULL OR p.category_id = $4)
         ORDER BY p.id ASC
         LIMIT $5 OFFSET $6`,
        [req.user.sub, keyword, keywordPattern, categoryId, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT p.id, p.category_id, c.name AS category_name,
                p.name, p.price, p.description, p.ingredients, p.is_active,
                CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url,
                p.ingredient_details
         FROM products p
         JOIN product_categories c
           ON c.id = p.category_id AND c.user_id = p.user_id
         WHERE p.user_id = $1
           AND ($2 = '' OR p.name ILIKE $3 OR c.name ILIKE $3)
           AND ($4::uuid IS NULL OR p.category_id = $4)
         ORDER BY p.id ASC`,
        [req.user.sub, keyword, keywordPattern, categoryId],
      );
      total = result.rows.length;
    }

    res.json({
      data: result.rows,
      pagination: buildListPaginationMeta({ page, limit, total, hasPagination }),
    });
  } catch (error) {
    console.error("GET /products error:", error.message);
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.category_id, c.name AS category_name,
              p.name, p.price, p.description, p.ingredients, p.is_active, p.image_urls,
              CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url,
              p.ingredient_details
       FROM products p
       JOIN product_categories c
         ON c.id = p.category_id AND c.user_id = p.user_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to fetch product", error: error.message });
  }
}

async function create(req, res) {
  const normalized = normalizeProductPayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  try {
    const result = await pool.query(
      `INSERT INTO products (
         user_id, category_id, name, price, description, ingredients,
         is_active, image_urls, ingredient_details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, user_id, category_id, name, price, description, ingredients,
                 is_active,
                 CASE WHEN array_length(image_urls, 1) > 0 THEN image_urls[1] ELSE NULL END AS image_url,
                 ingredient_details`,
      [
        req.user.sub,
        payload.category_id,
        payload.name,
        payload.price,
        payload.description,
        payload.ingredients,
        payload.is_active,
        payload.image_urls,
        JSON.stringify(payload.ingredient_details),
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Product already exists" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "Invalid category_id for current user" });
    }
    console.error("POST /products error:", error.message);
    res.status(500).json({ message: "Failed to create product", error: error.message });
  }
}

async function update(req, res) {
  const normalized = normalizeProductPayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           category_id = $2,
           price = $3,
           description = $4,
           ingredients = $5,
           is_active = $6,
           image_urls = $7,
           ingredient_details = $8::jsonb,
           updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING id, user_id, category_id, name, price, description, ingredients,
                 is_active,
                 CASE WHEN array_length(image_urls, 1) > 0 THEN image_urls[1] ELSE NULL END AS image_url,
                 ingredient_details`,
      [
        payload.name,
        payload.category_id,
        payload.price,
        payload.description,
        payload.ingredients,
        payload.is_active,
        payload.image_urls,
        JSON.stringify(payload.ingredient_details),
        req.params.id,
        req.user.sub,
      ],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Product already exists" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "Invalid category_id for current user" });
    }
    console.error("PUT /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to update product", error: error.message });
  }
}

async function remove(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM products
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
