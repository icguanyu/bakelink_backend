const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
  const sqlPath = path.join(__dirname, "..", "sql", "init_users.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@bakelink.local")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminName = (process.env.ADMIN_NAME || "System Admin").trim();

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
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         updated_at = NOW()`,
      [adminName, adminEmail, passwordHash],
    );

    console.log("Database initialized: users table is ready.");
    console.log(`Admin account ready: ${adminEmail}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("db:init failed:", error.message);
  process.exit(1);
});
