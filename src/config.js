const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwt: {
    secret: process.env.JWT_SECRET || "change_me_in_env",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  upload: {
    maxFileSizeBytes: Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || 5242880),
    allowedMimePrefix: process.env.UPLOAD_ALLOWED_MIME_PREFIX || "image/",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "",
  },
  pg: {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || process.env.PGSQL_PASSWORD || "",
    ssl:
      process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_TIMEOUT_MS || 5000),
    statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000),
    query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 15000),
  },
};
