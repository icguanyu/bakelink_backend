const jwt = require("jsonwebtoken");
const { jwt: jwtCfg } = require("../config");

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({ message: "缺少 Bearer 權杖。" });
  }

  try {
    req.user = jwt.verify(token, jwtCfg.secret);
    next();
  } catch (error) {
    return res.status(401).json({ message: "權杖無效或已過期。" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "需要管理員權限。" });
  }
  next();
}

module.exports = { authRequired, adminOnly };
