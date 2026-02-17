const express = require("express");
const router = express.Router();
const {
  list,
  listByMonth,
  getById,
  create,
  update,
  remove,
} = require("../controllers/scheduleController");
const { authRequired } = require("../middleware/auth");

router.get("/month/:month", authRequired, listByMonth);
router.post("/list", authRequired, list);
router.get("/:id", authRequired, getById);
router.post("/", authRequired, create);
router.put("/:id", authRequired, update);
router.delete("/:id", authRequired, remove);

module.exports = router;
