const jwt = require("jsonwebtoken");
const { jwt: jwtCfg } = require("../config");

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  try {
    req.user = jwt.verify(token, jwtCfg.secret);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

module.exports = { authRequired, adminOnly };
