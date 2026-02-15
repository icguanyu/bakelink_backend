const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

async function main() {
  const sqlPath = path.join(__dirname, "..", "sql", "init_users.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const pool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || process.env.PGSQL_PASSWORD || "",
    ssl:
      process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(sql);
    console.log("Database initialized: users table is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("db:init failed:", error.message);
  process.exit(1);
});