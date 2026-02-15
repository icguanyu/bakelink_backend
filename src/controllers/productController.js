const { pool } = require("../db");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

async function list(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const keyword = String(req.query.keyword || "").trim();
    const keywordPattern = `%${keyword}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM products p
       JOIN product_categories c
         ON c.id = p.category_id AND c.user_id = p.user_id
       WHERE p.user_id = $1
         AND ($2 = '' OR p.name ILIKE $3 OR c.name ILIKE $3)`,
      [req.user.sub, keyword, keywordPattern],
    );
    const total = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `SELECT p.id, p.user_id, p.category_id, c.name AS category_name,
              p.name, p.created_at, p.updated_at
       FROM products p
       JOIN product_categories c
         ON c.id = p.category_id AND c.user_id = p.user_id
       WHERE p.user_id = $1
         AND ($2 = '' OR p.name ILIKE $3 OR c.name ILIKE $3)
       ORDER BY p.created_at ASC
       LIMIT $4 OFFSET $5`,
      [req.user.sub, keyword, keywordPattern, limit, offset],
    );
    res.json({
      data: result.rows,
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("GET /products error:", error.message);
    res.status(500).json({ message: "Failed to fetch products.", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.category_id, c.name AS category_name,
              p.name, p.created_at, p.updated_at
       FROM products p
       JOIN product_categories c
         ON c.id = p.category_id AND c.user_id = p.user_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to fetch product.", error: error.message });
  }
}

async function create(req, res) {
  const { name, category_id } = req.body || {};
  if (!name || !String(name).trim() || !category_id) {
    return res.status(400).json({ message: "name and category_id are required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (user_id, category_id, name)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, category_id, name, created_at, updated_at`,
      [req.user.sub, category_id, String(name).trim()],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Product already exists." });
    }
    if (error.code === "23503") {
      return res.status(400).json({
        message: "Invalid category_id. Category must belong to current user.",
      });
    }
    console.error("POST /products error:", error.message);
    res.status(500).json({ message: "Failed to create product.", error: error.message });
  }
}

async function update(req, res) {
  const { name, category_id } = req.body || {};
  if (!name || !String(name).trim() || !category_id) {
    return res.status(400).json({ message: "name and category_id are required." });
  }

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = $1, category_id = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, user_id, category_id, name, created_at, updated_at`,
      [String(name).trim(), category_id, req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Product already exists." });
    }
    if (error.code === "23503") {
      return res.status(400).json({
        message: "Invalid category_id. Category must belong to current user.",
      });
    }
    console.error("PUT /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to update product.", error: error.message });
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
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /products/:id error:", error.message);
    res.status(500).json({ message: "Failed to delete product.", error: error.message });
  }
}

module.exports = { list, getById, create, update, remove };
