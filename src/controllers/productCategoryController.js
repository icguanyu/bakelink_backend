const { pool } = require("../db");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");

async function list(req, res) {
  try {
    const source = req.method === "POST" ? req.body || {} : req.query;
    const { hasPagination, page, limit, offset } = resolvePagination(source);
    const keyword = String(source.keyword || "").trim();
    const keywordPattern = `%${keyword}%`;

    let total = 0;
    let result;

    if (hasPagination) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM product_categories
         WHERE user_id = $1
           AND ($2 = '' OR name ILIKE $3)`,
        [req.user.sub, keyword, keywordPattern],
      );
      total = countResult.rows[0]?.total || 0;

      result = await pool.query(
        `SELECT id, name
         FROM product_categories
         WHERE user_id = $1
           AND ($2 = '' OR name ILIKE $3)
         ORDER BY id ASC
         LIMIT $4 OFFSET $5`,
        [req.user.sub, keyword, keywordPattern, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT id, name
         FROM product_categories
         WHERE user_id = $1
           AND ($2 = '' OR name ILIKE $3)
         ORDER BY id ASC`,
        [req.user.sub, keyword, keywordPattern],
      );
      total = result.rows.length;
    }

    res.json({
      data: result.rows,
      pagination: buildListPaginationMeta({ page, limit, total, hasPagination }),
    });
  } catch (error) {
    console.error("GET /product-categories error:", error.message);
    res.status(500).json({ message: "取得分類失敗。", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name
       FROM product_categories
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到分類。" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /product-categories/:id error:", error.message);
    res.status(500).json({ message: "取得分類失敗。", error: error.message });
  }
}

async function create(req, res) {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "必須提供名稱。" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO product_categories (user_id, name)
       VALUES ($1, $2)
       RETURNING id, user_id, name`,
      [req.user.sub, String(name).trim()],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "分類名稱已存在。" });
    }
    console.error("POST /product-categories error:", error.message);
    res.status(500).json({ message: "建立分類失敗。", error: error.message });
  }
}

async function update(req, res) {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "必須提供名稱。" });
  }

  try {
    const result = await pool.query(
      `UPDATE product_categories
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name`,
      [String(name).trim(), req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到分類。" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "分類名稱已存在。" });
    }
    console.error("PUT /product-categories/:id error:", error.message);
    res.status(500).json({ message: "更新分類失敗。", error: error.message });
  }
}

async function remove(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM product_categories
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到分類。" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /product-categories/:id error:", error.message);
    res.status(500).json({ message: "刪除分類失敗。", error: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
