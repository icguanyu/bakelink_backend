const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { jwt: jwtCfg } = require("../config");

async function register(req, res) {
  const { name, email, password, phone } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "必須提供名稱、電子郵件與密碼。",
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      message: "密碼至少需 8 個字元。",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO users (name, phone, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, name, phone, email, role`,
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
      return res.status(409).json({ message: "電子郵件已存在。" });
    }
    console.error("POST /auth/register error:", error.message);
    res.status(500).json({ message: "註冊失敗。", error: error.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "必須提供電子郵件與密碼。" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: "電子郵件或密碼不正確。" });
    }

    const isValidPassword = await bcrypt.compare(
      String(password),
      user.password_hash,
    );

    if (!isValidPassword) {
      return res.status(401).json({ message: "電子郵件或密碼不正確。" });
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
      },
    });
  } catch (error) {
    console.error("POST /auth/login error:", error.message);
    res.status(500).json({ message: "登入失敗。", error: error.message });
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
      return res.status(404).json({ message: "找不到使用者。" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("GET /auth/me error:", error.message);
    res
      .status(500)
      .json({ message: "取得個人資料失敗。", error: error.message });
  }
}

module.exports = { register, login, me };
