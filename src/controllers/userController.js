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
      message: "資料庫查詢失敗，請檢查 PostgreSQL 設定。",
      error: error.message,
    });
  }
}

module.exports = { list };
