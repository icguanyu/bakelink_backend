const express = require("express");
const router = express.Router();
const {
  list,
  getById,
  create,
  update,
  remove,
} = require("../controllers/productController");
const { authRequired } = require("../middleware/auth");

router.get("/", authRequired, list);
router.get("/:id", authRequired, getById);
router.post("/", authRequired, create);
router.put("/:id", authRequired, update);
router.delete("/:id", authRequired, remove);

module.exports = router;
