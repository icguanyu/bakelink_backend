const express = require("express");
const router = express.Router();
const { list } = require("../controllers/userController");
const { authRequired, adminOnly } = require("../middleware/auth");

router.get("/", authRequired, adminOnly, list);

module.exports = router;
