const express = require("express");
const router = express.Router();
const { list, getMe, updateMe, bindLine, unbindLine } = require("../controllers/userController");
const { authRequired, adminOnly } = require("../middleware/auth");

router.get("/", authRequired, adminOnly, list);
router.get("/me", authRequired, getMe);
router.put("/me", authRequired, updateMe);
router.patch("/me", authRequired, updateMe);
router.patch("/me/line", authRequired, bindLine);
router.delete("/me/line", authRequired, unbindLine);

module.exports = router;
