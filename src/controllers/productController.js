const { pool } = require("../db");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");
const { normalizeDecimalFields } = require("../utils/number");

function normalizeProductPayload(body = {}) {
  const { name, category_id, price } = body;
  if (!name || !String(name).trim() || !category_id) {
    return { error: "商品名稱（name）與分類（category_id）為必填" };
  }

  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return { error: "price 必須為非負數" };
  }

  const description =
    body.description == null ? null : String(body.description).trim();
  const ingredients =
    body.ingredients == null ? null : String(body.ingredients).trim();

  const isActiveRaw = body.is_active;
  let isActive = true;
  if (isActiveRaw != null) {
    if (typeof isActiveRaw !== "boolean") {
      return { error: "is_active 必須為布林值（true/false）" };
    }
    isActive = isActiveRaw;
  }

  const isSliceableRaw = body.is_sliceable;
  let isSliceable = false;
  if (isSliceableRaw != null) {
    if (typeof isSliceableRaw !== "boolean") {
      return { error: "is_sliceable 必須為布林值（true/false）" };
    }
    isSliceable = isSliceableRaw;
  }

  const imageUrlsRaw = body.image_urls;
  let imageUrls = [];
  if (imageUrlsRaw != null) {
    if (!Array.isArray(imageUrlsRaw)) {
      return { error: "image_urls 必須為字串陣列" };
    }
    imageUrls = imageUrlsRaw.map((url) => String(url || "").trim());
    if (imageUrls.some((url) => !url)) {
      return { error: "image_urls 不可包含空字串" };
    }
  }

  const ingredientDetailsRaw = body.ingredient_details;
  let ingredientDetails = [];
  if (ingredientDetailsRaw != null) {
    if (!Array.isArray(ingredientDetailsRaw)) {
      return { error: "ingredient_details 必須為陣列" };
    }

    ingredientDetails = ingredientDetailsRaw.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { __invalid: "ingredient_details 的每個項目必須為物件" };
      }

      const detailName = String(item.name || "").trim();
      const gramsNum = Number(item.grams);
      const isVisible = item.is_visible;

      if (!detailName) {
        return { __invalid: "成分名稱（name）為必填" };
      }
      if (!Number.isFinite(gramsNum) || gramsNum < 0) {
        return { __invalid: "成分的 grams 必須為非負數" };
      }
      if (typeof isVisible !== "boolean") {
        return { __invalid: "成分的 is_visible 必須為布林值" };
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
      is_sliceable: isSliceable,
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
                p.name, p.price, p.description, p.ingredients, p.is_active, p.is_sliceable,
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
                p.name, p.price, p.description, p.ingredients, p.is_active, p.is_sliceable,
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

    const data = result.rows.map((row) => normalizeDecimalFields(row, ["price"]));
    res.json({
      data,
      pagination: buildListPaginationMeta({ page, limit, total, hasPagination }),
    });
  } catch (error) {
    console.error("GET /products error:", error.message);
    res.status(500).json({ message: "取得商品列表失敗", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.category_id, c.name AS category_name,
              p.name, p.price, p.description, p.ingredients, p.is_active, p.is_sliceable, p.image_urls,
              CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url,
              p.ingredient_details
       FROM products p
       JOIN product_categories c
         ON c.id = p.category_id AND c.user_id = p.user_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到商品" });
    }

    res.json(normalizeDecimalFields(result.rows[0], ["price"]));
  } catch (error) {
    console.error("GET /products/:id error:", error.message);
    res.status(500).json({ message: "取得商品失敗", error: error.message });
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
         is_active, is_sliceable, image_urls, ingredient_details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id, user_id, category_id, name, price, description, ingredients,
                 is_active, is_sliceable,
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
        payload.is_sliceable,
        payload.image_urls,
        JSON.stringify(payload.ingredient_details),
      ],
    );

    res.status(201).json(normalizeDecimalFields(result.rows[0], ["price"]));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "商品名稱已存在" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "分類 ID 無效或不屬於此帳號" });
    }
    console.error("POST /products error:", error.message);
    res.status(500).json({ message: "建立商品失敗", error: error.message });
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
           is_sliceable = $7,
           image_urls = $8,
           ingredient_details = $9::jsonb,
           updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING id, user_id, category_id, name, price, description, ingredients,
                 is_active, is_sliceable,
                 CASE WHEN array_length(image_urls, 1) > 0 THEN image_urls[1] ELSE NULL END AS image_url,
                 ingredient_details`,
      [
        payload.name,
        payload.category_id,
        payload.price,
        payload.description,
        payload.ingredients,
        payload.is_active,
        payload.is_sliceable,
        payload.image_urls,
        JSON.stringify(payload.ingredient_details),
        req.params.id,
        req.user.sub,
      ],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到商品" });
    }

    res.json(normalizeDecimalFields(result.rows[0], ["price"]));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "商品名稱已存在" });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "分類 ID 無效或不屬於此帳號" });
    }
    console.error("PUT /products/:id error:", error.message);
    res.status(500).json({ message: "更新商品失敗", error: error.message });
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
      return res.status(404).json({ message: "找不到商品" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /products/:id error:", error.message);
    if (error.code === "23503") {
      return res.status(409).json({ message: "此商品已加入排程，無法刪除，請改為下架" });
    }
    res.status(500).json({ message: "刪除商品失敗", error: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
