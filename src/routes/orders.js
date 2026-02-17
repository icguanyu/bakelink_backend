const express = require("express");
const router = express.Router();
const { authRequired } = require("../middleware/auth");
const {
  list,
  getById,
  create,
  updateStatus,
  remove,
} = require("../controllers/orderController");

router.post("/list", authRequired, list);
router.get("/:id", authRequired, getById);
router.post("/", authRequired, create);
router.put("/:id/status", authRequired, updateStatus);
router.delete("/:id", authRequired, remove);

module.exports = router;
