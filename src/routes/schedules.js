const express = require("express");
const router = express.Router();
const {
  list,
  listByMonth,
  getByDate,
  getById,
  create,
  update,
  remove,
} = require("../controllers/scheduleController");
const { authRequired } = require("../middleware/auth");

router.get("/month/:month", authRequired, listByMonth);
router.post("/list", authRequired, list);
router.get("/detail/:id", authRequired, getById);
router.get("/:date", authRequired, getByDate);
router.post("/", authRequired, create);
router.put("/:id", authRequired, update);
router.delete("/:id", authRequired, remove);

module.exports = router;
