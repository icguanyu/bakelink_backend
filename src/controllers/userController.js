const { pool } = require("../db");

async function list(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, role, created_at
       FROM users
       ORDER BY created_at ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /users error:", error.message);
    res.status(500).json({
      message:
        "Database query failed. Please check your PostgreSQL settings.",
      error: error.message,
    });
  }
}

module.exports = { list };
