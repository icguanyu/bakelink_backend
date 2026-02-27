const express = require("express");
const router = express.Router();
const { list, getMe, updateMe } = require("../controllers/userController");
const { authRequired, adminOnly } = require("../middleware/auth");

router.get("/", authRequired, adminOnly, list);
router.get("/me", authRequired, getMe);
router.put("/me", authRequired, updateMe);
router.patch("/me", authRequired, updateMe);

module.exports = router;
