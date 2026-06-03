const express = require("express");
const router = express.Router();
const {
  getShopInfo,
  listSchedules,
  getScheduleByDate,
  listCategories,
  listProducts,
  createOrder,
  getOrderByNo,
} = require("../controllers/shopController");

router.get("/:slug", getShopInfo);
router.get("/:slug/schedules", listSchedules);
router.get("/:slug/schedules/:date", getScheduleByDate);
router.get("/:slug/categories", listCategories);
router.get("/:slug/products", listProducts);
router.post("/:slug/orders", createOrder);
router.get("/:slug/orders/:orderNo", getOrderByNo);

module.exports = router;
