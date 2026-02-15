const { pool } = require("../db");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

async function list(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const keyword = String(req.query.keyword || "").trim();
    const keywordPattern = `%${keyword}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM product_categories
       WHERE user_id = $1
         AND ($2 = '' OR name ILIKE $3)`,
      [req.user.sub, keyword, keywordPattern],
    );
    const total = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `SELECT id, user_id, name, created_at, updated_at
       FROM product_categories
       WHERE user_id = $1
         AND ($2 = '' OR name ILIKE $3)
       ORDER BY created_at ASC
       LIMIT $4 OFFSET $5`,
      [req.user.sub, keyword, keywordPattern, limit, offset],
    );
    res.json({
      data: result.rows,
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("GET /product-categories error:", error.message);
    res.status(500).json({ message: "Failed to fetch categories.", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, created_at, updated_at
       FROM product_categories
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /product-categories/:id error:", error.message);
    res.status(500).json({ message: "Failed to fetch category.", error: error.message });
  }
}

async function create(req, res) {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "name is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO product_categories (user_id, name)
       VALUES ($1, $2)
       RETURNING id, user_id, name, created_at, updated_at`,
      [req.user.sub, String(name).trim()],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category name already exists." });
    }
    console.error("POST /product-categories error:", error.message);
    res.status(500).json({ message: "Failed to create category.", error: error.message });
  }
}

async function update(req, res) {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "name is required." });
  }

  try {
    const result = await pool.query(
      `UPDATE product_categories
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name, created_at, updated_at`,
      [String(name).trim(), req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Category name already exists." });
    }
    console.error("PUT /product-categories/:id error:", error.message);
    res.status(500).json({ message: "Failed to update category.", error: error.message });
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
      return res.status(404).json({ message: "Category not found." });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /product-categories/:id error:", error.message);
    res.status(500).json({ message: "Failed to delete category.", error: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
