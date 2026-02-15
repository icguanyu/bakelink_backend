const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { jwt: jwtCfg } = require("../config");

async function register(req, res) {
  const { name, email, password, phone } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email, and password are required.",
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO users (name, phone, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, name, phone, email, role, created_at`,
      [
        String(name).trim(),
        phone ? String(phone).trim() : null,
        String(email).trim().toLowerCase(),
        passwordHash,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists." });
    }
    console.error("POST /auth/register error:", error.message);
    res.status(500).json({ message: "Register failed.", error: error.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "email and password are required." });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, password_hash, role, created_at
       FROM users
       WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isValidPassword = await bcrypt.compare(
      String(password),
      user.password_hash,
    );

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
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
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("POST /auth/login error:", error.message);
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, role, created_at
       FROM users
       WHERE id = $1`,
      [req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /auth/me error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to fetch profile.", error: error.message });
  }
}

module.exports = { register, login, me };
