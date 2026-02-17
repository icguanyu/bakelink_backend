const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
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
    const sqlDir = path.join(__dirname, "..", "sql");
    const baseSqlFiles = ["init_users.sql", "init_products.sql"];
    for (const fileName of baseSqlFiles) {
      const sqlPath = path.join(sqlDir, fileName);
      if (!fs.existsSync(sqlPath)) {
        continue;
      }
      const sql = fs.readFileSync(sqlPath, "utf8");
      await pool.query(sql);
      console.log(`Applied base SQL: ${fileName}`);
    }

    const migrationsDir = path.join(sqlDir, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((name) => name.toLowerCase().endsWith(".sql"))
        .sort();

      for (const fileName of migrationFiles) {
        const sqlPath = path.join(migrationsDir, fileName);
        const sql = fs.readFileSync(sqlPath, "utf8");
        await pool.query(sql);
        console.log(`Applied migration: ${fileName}`);
      }
    }

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

    console.log("Database initialized successfully.");
    console.log(`Admin account ready: ${adminEmail}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("db:init failed:", error.message);
  process.exit(1);
});
