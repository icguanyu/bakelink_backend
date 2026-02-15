const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || process.env.PGSQL_PASSWORD || "",
  ssl:
    process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

app.get("/", (req, res) => {
  res.send("BakeLink backend is running");
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users ORDER BY id ASC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /users error:", error.message);
    res.status(500).json({
      message: "Database query failed. Please check your PostgreSQL settings.",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
