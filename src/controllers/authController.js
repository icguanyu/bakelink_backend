const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { jwt: jwtCfg } = require("../config");

function generateSlugFromEmail(email) {
  let slug = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length < 3) slug = slug.padEnd(3, "0");
  if (slug.length > 50) slug = slug.slice(0, 50);
  return slug;
}

async function generateUniqueSlug(client, baseSlug) {
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0
      ? baseSlug
      : `${baseSlug.slice(0, 46)}-${Math.random().toString(36).slice(2, 5)}`;
    const { rows } = await client.query(
      `SELECT 1 FROM users WHERE shop_slug = $1`,
      [candidate],
    );
    if (rows.length === 0) return candidate;
  }
  return `${baseSlug.slice(0, 42)}-${Date.now().toString(36).slice(-6)}`;
}

async function register(req, res) {
  const { name, email, password, phone } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email, and password are required",
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      message: "password must be at least 8 characters",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(String(password), 10);
    const shopSlug = await generateUniqueSlug(client, generateSlugFromEmail(normalizedEmail));

    const result = await client.query(
      `INSERT INTO users (name, phone, email, password_hash, role, shop_slug)
       VALUES ($1, $2, $3, $4, 'user', $5)
       RETURNING id, name, phone, email, role, shop_slug`,
      [
        String(name).trim(),
        phone ? String(phone).trim() : null,
        normalizedEmail,
        passwordHash,
        shopSlug,
      ],
    );
    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }
    console.error("POST /auth/register error:", error.message);
    res.status(500).json({ message: "Failed to register user", error: error.message });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "email and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, password_hash, role, shop_slug
       FROM users
       WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(
      String(password),
      user.password_hash,
    );

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      jwtCfg.secret,
      { expiresIn: jwtCfg.expiresIn },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        shop_slug: user.shop_slug,
      },
    });
  } catch (error) {
    console.error("POST /auth/login error:", error.message);
    res.status(500).json({ message: "Failed to login", error: error.message });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, role
       FROM users
       WHERE id = $1`,
      [req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /auth/me error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch user profile", error: error.message });
  }
}

module.exports = { register, login, me, generateSlugFromEmail };
