const { pool } = require("../db");
const {
  resolveTimeZone,
  formatDateInTimeZone,
  formatDatetimeInTimeZone,
  formatTimeToHHmm,
} = require("../utils/datetime");
const { normalizeDecimalFields } = require("../utils/number");

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function resolveShopUserId(slug) {
  const result = await pool.query(
    `SELECT id FROM users WHERE shop_slug = $1`,
    [slug],
  );
  return result.rows[0]?.id || null;
}

function formatScheduleRow(row, timeZone) {
  return {
    ...row,
    schedule_date: formatDateInTimeZone(row.schedule_date, timeZone),
    order_start_at: formatDatetimeInTimeZone(row.order_start_at, timeZone),
    order_end_at: formatDatetimeInTimeZone(row.order_end_at, timeZone),
  };
}

function getOrderNoPhonePart(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 0) return "000";
  if (digits.startsWith("0") && digits.length >= 4) return digits.slice(1, 4);
  if (digits.length >= 3) return digits.slice(0, 3);
  return digits.padStart(3, "0");
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug
// 店家公開資訊（無需登入）
// ────────────────────────────────────────────────────────────
async function getShopInfo(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, shop_slug, shop_name, owner_name, avatar, cover, intro,
              phone, address,
              payment_methods, pickup_methods, order_pickup_time,
              business_hours, line_url, facebook_url, instagram_url
       FROM users
       WHERE shop_slug = $1`,
      [slug],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到商店" });
    }
    const row = result.rows[0];
    return res.json({
      shopSlug: row.shop_slug,
      shopName: row.shop_name || "",
      ownerName: row.owner_name || "",
      phone: row.phone || "",
      address: row.address || "",
      avatar: row.avatar || "",
      cover: row.cover || "",
      intro: row.intro || "",
      paymentMethods: row.payment_methods || [],
      pickupMethods: row.pickup_methods || [],
      orderPickupTime: formatTimeToHHmm(row.order_pickup_time) || "",
      businessHours: row.business_hours || [],
      lineUrl: row.line_url || "",
      facebookUrl: row.facebook_url || "",
      instagramUrl: row.instagram_url || "",
    });
  } catch (error) {
    console.error("GET /shop/:slug error:", error.message);
    return res.status(500).json({ message: "取得商店資訊失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/schedules?month=YYYY-MM
// 開放中行程清單（ANNOUNCED / OPEN）
// ────────────────────────────────────────────────────────────
async function listSchedules(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const month = req.query.month ? String(req.query.month).trim() : null;

    const values = [userId];
    let paramIndex = 2;
    const whereClauses = [
      "user_id = $1",
      "status = ANY('{ANNOUNCED,OPEN,CLOSED}')",
    ];

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month 參數格式必須為 YYYY-MM" });
      }
      const [yearText, monthText] = month.split("-");
      const year = Number(yearText);
      const monthNum = Number(monthText);
      const start = new Date(Date.UTC(year, monthNum - 1, 1));
      const end = new Date(Date.UTC(year, monthNum, 1));
      whereClauses.push(`schedule_date >= $${paramIndex}`);
      values.push(start.toISOString().slice(0, 10));
      paramIndex += 1;
      whereClauses.push(`schedule_date < $${paramIndex}`);
      values.push(end.toISOString().slice(0, 10));
      paramIndex += 1;
    }

    const result = await pool.query(
      `SELECT id, schedule_date::text AS schedule_date, status, note,
              order_start_at, order_end_at,
              venue_name, venue_address, TO_CHAR(venue_start, 'HH24:MI') AS venue_start, TO_CHAR(venue_end, 'HH24:MI') AS venue_end,
              (venue_name IS NOT NULL) AS is_venue
       FROM schedules
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY schedule_date ASC`,
      values,
    );

    const schedules = result.rows;
    const timeZone = resolveTimeZone(req);

    if (schedules.length === 0) {
      return res.json({ data: [] });
    }

    const scheduleIds = schedules.map((r) => r.id);
    const itemsResult = await pool.query(
      `SELECT si.id, si.schedule_id, si.product_id, si.product_name, si.unit_price, si.sales_limit,
              CASE
                WHEN si.sales_limit IS NULL THEN NULL
                ELSE GREATEST(0, si.sales_limit - COALESCE(sold.sold_qty, 0))
              END AS remaining,
              CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url
       FROM schedule_items si
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN (
         SELECT oi.schedule_item_id, SUM(oi.quantity)::int AS sold_qty
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status IN ('PLACED', 'COMPLETED')
         GROUP BY oi.schedule_item_id
       ) sold ON sold.schedule_item_id = si.id
       WHERE si.schedule_id = ANY($1)
       ORDER BY si.schedule_id, si.id ASC`,
      [scheduleIds],
    );

    const itemsBySchedule = {};
    for (const item of itemsResult.rows) {
      if (!itemsBySchedule[item.schedule_id]) itemsBySchedule[item.schedule_id] = [];
      itemsBySchedule[item.schedule_id].push(normalizeDecimalFields(item, ["unit_price"]));
    }

    return res.json({
      data: schedules.map((row) => ({
        ...formatScheduleRow(row, timeZone),
        items: itemsBySchedule[row.id] || [],
      })),
    });
  } catch (error) {
    console.error("GET /shop/:slug/schedules error:", error.message);
    return res.status(500).json({ message: "取得排程列表失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/schedules/:date
// 特定日期行程詳細 + 各品項剩餘數量
// ────────────────────────────────────────────────────────────
async function getScheduleByDate(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const date = String(req.params.date || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "date 參數格式必須為 YYYY-MM-DD" });
    }

    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const scheduleResult = await pool.query(
      `SELECT id, schedule_date::text AS schedule_date, status, note,
              order_start_at, order_end_at,
              venue_name, venue_address, TO_CHAR(venue_start, 'HH24:MI') AS venue_start, TO_CHAR(venue_end, 'HH24:MI') AS venue_end,
              (venue_name IS NOT NULL) AS is_venue
       FROM schedules
       WHERE user_id = $1
         AND schedule_date = $2::date
         AND status = ANY('{ANNOUNCED,OPEN,CLOSED}')
       ORDER BY id ASC
       LIMIT 1`,
      [userId, date],
    );
    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      return res.status(404).json({ message: "找不到排程" });
    }

    const itemsResult = await pool.query(
      `SELECT si.id, si.product_id, si.product_name, si.unit_price, si.sales_limit,
              CASE
                WHEN si.sales_limit IS NULL THEN NULL
                ELSE GREATEST(0, si.sales_limit - COALESCE(sold.sold_qty, 0))
              END AS remaining,
              p.is_sliceable,
              p.slice_price,
              CASE WHEN array_length(p.image_urls, 1) > 0 THEN p.image_urls[1] ELSE NULL END AS image_url
       FROM schedule_items si
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN (
         SELECT oi.schedule_item_id, SUM(oi.quantity)::int AS sold_qty
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status IN ('PLACED', 'COMPLETED')
         GROUP BY oi.schedule_item_id
       ) sold ON sold.schedule_item_id = si.id
       WHERE si.schedule_id = $1
       ORDER BY si.id ASC`,
      [schedule.id],
    );

    const timeZone = resolveTimeZone(req);
    return res.json({
      ...formatScheduleRow(schedule, timeZone),
      items: itemsResult.rows.map((item) =>
        normalizeDecimalFields(item, ["unit_price", "slice_price"]),
      ),
    });
  } catch (error) {
    console.error("GET /shop/:slug/schedules/:date error:", error.message);
    return res.status(500).json({ message: "取得排程失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/categories
// 有上架商品的種類清單（無需登入）
// ────────────────────────────────────────────────────────────
async function listCategories(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const result = await pool.query(
      `SELECT DISTINCT pc.id, pc.name
       FROM product_categories pc
       JOIN products p ON p.category_id = pc.id
       WHERE p.user_id = $1 AND p.is_active = true
       ORDER BY pc.name ASC`,
      [userId],
    );

    return res.json({ data: result.rows });
  } catch (error) {
    console.error("GET /shop/:slug/categories error:", error.message);
    return res.status(500).json({ message: "取得分類列表失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/products[?category_id=xxx]
// 店家上架商品清單（無需登入）
// ────────────────────────────────────────────────────────────
async function listProducts(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const categoryId = req.query.category_id ? String(req.query.category_id).trim() : null;

    const values = [userId];
    const whereClauses = ["user_id = $1", "is_active = true"];

    if (categoryId) {
      values.push(categoryId);
      whereClauses.push(`category_id = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT id, category_id, name, price, description, ingredients, image_urls, ingredient_details
       FROM products
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY name ASC`,
      values,
    );

    return res.json({
      data: result.rows.map((row) => normalizeDecimalFields(row, ["price"])),
    });
  } catch (error) {
    console.error("GET /shop/:slug/products error:", error.message);
    return res.status(500).json({ message: "取得商品列表失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// POST /shop/:slug/orders
// 客人下單（無需登入）
// ────────────────────────────────────────────────────────────
function normalizeCustomerOrderPayload(body = {}) {
  const scheduleId = String(body.schedule_id || "").trim();
  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const customerAddress = body.customer_address == null
    ? null
    : String(body.customer_address).trim() || null;
  const paymentMethod = String(body.payment_method || "").trim();
  const note = body.note == null ? null : String(body.note).trim() || null;

  const bringOwnBag = typeof body.bring_own_bag === "boolean"
    ? body.bring_own_bag
    : false;

  const rawPickup = String(body.pickup_method || "PICKUP").trim().toUpperCase();
  const pickupAliasMap = { PICKUP: "PICKUP", SELF_PICKUP: "PICKUP", DELIVERY: "DELIVERY", 自取: "PICKUP", 宅配: "DELIVERY" };
  const pickupMethod = pickupAliasMap[rawPickup] || "PICKUP";

  if (!scheduleId) return { error: "schedule_id 為必填" };
  if (!customerName) return { error: "顧客姓名（customer_name）為必填" };
  if (!customerPhone) return { error: "顧客電話（customer_phone）為必填" };
  if (!paymentMethod) return { error: "付款方式（payment_method）為必填" };

  const pickupTime = String(body.pickup_time || "").trim();
  if (!pickupTime) return { error: "取件時間（pickup_time）為必填" };
  if (!/^([0-1]?\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
    return { error: "pickup_time 格式必須為 HH:mm（例如：12:00）" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "訂單商品（items）為必填且不可為空" };
  }

  const items = [];
  for (const item of body.items) {
    if (!item || typeof item !== "object") return { error: "每筆商品項目必須為物件格式" };
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "item.quantity 必須為正整數" };
    }
    const scheduleItemId = String(item.schedule_item_id || "").trim();
    if (!scheduleItemId) return { error: "item.schedule_item_id 為必填" };
    const isSliced = typeof item.is_sliced === "boolean" ? item.is_sliced : false;
    items.push({ schedule_item_id: scheduleItemId, quantity, is_sliced: isSliced });
  }

  return {
    value: {
      schedule_id: scheduleId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      pickup_time: pickupTime,
      note,
      payment_method: paymentMethod,
      bring_own_bag: bringOwnBag,
      pickup_method: pickupMethod,
      items,
    },
  };
}

async function createOrder(req, res) {
  const normalized = normalizeCustomerOrderPayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const slug = String(req.params.slug || "").trim().toLowerCase();
  const userId = await resolveShopUserId(slug);
  if (!userId) {
    return res.status(404).json({ message: "找不到商店" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const scheduleResult = await client.query(
      `SELECT id, status, schedule_date::text AS schedule_date
       FROM schedules
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [payload.schedule_id, userId],
    );
    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到排程" });
    }
    if (schedule.status !== "OPEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "此排程目前不開放接單" });
    }

    const orderDate = String(schedule.schedule_date || "").replace(/-/g, "");
    const orderNoPhonePart = getOrderNoPhonePart(payload.customer_phone);

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${userId}:${orderDate}`],
    );
    const sequenceResult = await client.query(
      `SELECT (COUNT(*) + 1)::int AS next_sequence
       FROM orders
       WHERE user_id = $1
         AND schedule_id IN (
           SELECT id FROM schedules
           WHERE user_id = $1 AND schedule_date = $2::date
         )`,
      [userId, schedule.schedule_date],
    );
    const nextSequence = sequenceResult.rows[0]?.next_sequence || 1;
    const orderNo = `${orderNoPhonePart}-${orderDate}-${String(nextSequence).padStart(3, "0")}`;

    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, order_no, schedule_id, status,
         customer_name, customer_phone, customer_address,
         pickup_time, note, payment_method, bring_own_bag, pickup_method, total_amount
       ) VALUES ($1, $2, $3, 'PLACED', $4, $5, $6, $7, $8, $9, $10, $11, 0)
       RETURNING id, order_no, status, customer_name, customer_phone,
                 pickup_time, pickup_method, bring_own_bag, total_amount`,
      [
        userId,
        orderNo,
        payload.schedule_id,
        payload.customer_name,
        payload.customer_phone,
        payload.customer_address,
        payload.pickup_time,
        payload.note,
        payload.payment_method,
        payload.bring_own_bag,
        payload.pickup_method,
      ],
    );
    const order = orderResult.rows[0];

    let totalAmount = 0;
    const orderItems = [];
    for (const item of payload.items) {
      const scheduleItemResult = await client.query(
        `SELECT id, product_id, product_name, unit_price, sales_limit
         FROM schedule_items
         WHERE id = $1 AND schedule_id = $2
         FOR UPDATE`,
        [item.schedule_item_id, payload.schedule_id],
      );
      const si = scheduleItemResult.rows[0];
      if (!si) throw new Error("SCHEDULE_ITEM_NOT_FOUND");

      if (si.sales_limit !== null) {
        const soldResult = await client.query(
          `SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold_qty
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.schedule_item_id = $1
             AND o.status IN ('PLACED', 'COMPLETED')`,
          [si.id],
        );
        const soldQty = soldResult.rows[0]?.sold_qty || 0;
        if (soldQty + item.quantity > si.sales_limit) {
          throw new Error("SALES_LIMIT_EXCEEDED");
        }
      }

      const lineTotal = Number(si.unit_price) * item.quantity;
      totalAmount += lineTotal;

      await client.query(
        `INSERT INTO order_items (
           order_id, schedule_item_id, product_id, product_name,
           unit_price, quantity, is_sliced, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order.id, si.id, si.product_id, si.product_name, si.unit_price, item.quantity, item.is_sliced, lineTotal],
      );

      orderItems.push(
        normalizeDecimalFields(
          { product_name: si.product_name, unit_price: si.unit_price, quantity: item.quantity, is_sliced: item.is_sliced, line_total: lineTotal },
          ["unit_price", "line_total"],
        ),
      );
    }

    const finalOrder = await client.query(
      `UPDATE orders SET total_amount = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_no, status, customer_name, customer_phone,
                 pickup_time, pickup_method, bring_own_bag, note, total_amount`,
      [totalAmount, order.id],
    );

    await client.query("COMMIT");

    const row = finalOrder.rows[0];
    return res.status(201).json({
      ...normalizeDecimalFields(row, ["total_amount"]),
      pickup_time: formatTimeToHHmm(row.pickup_time),
      pickup_method: String(row.pickup_method || "").toLowerCase(),
      schedule_date: schedule.schedule_date,
      items: orderItems,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "SCHEDULE_ITEM_NOT_FOUND") {
      return res.status(400).json({ message: "部分商品不在此排程中" });
    }
    if (error.message === "SALES_LIMIT_EXCEEDED") {
      return res.status(409).json({ message: "一或多項商品已超過銷售數量上限" });
    }
    console.error("POST /shop/:slug/orders error:", error.message);
    return res.status(500).json({ message: "建立訂單失敗" });
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/orders?phone=xxx
// 客人用電話查詢所有訂單（最新在前）
// ────────────────────────────────────────────────────────────
async function listOrdersByPhone(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const phone = String(req.query.phone || "").trim();

    if (!phone) {
      return res.status(400).json({ message: "查詢時必須提供 phone 參數" });
    }

    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const ordersResult = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.customer_name, o.customer_phone,
              o.customer_address, o.pickup_time, o.pickup_method, o.bring_own_bag,
              o.note, o.payment_method, o.total_amount,
              s.schedule_date::text AS schedule_date,
              s.venue_name, s.venue_address, TO_CHAR(s.venue_start, 'HH24:MI') AS venue_start, TO_CHAR(s.venue_end, 'HH24:MI') AS venue_end,
              (s.venue_name IS NOT NULL) AS is_venue
       FROM orders o
       JOIN schedules s ON s.id = o.schedule_id
       WHERE o.user_id = $1
         AND o.customer_phone = $2
       ORDER BY o.created_at DESC`,
      [userId, phone],
    );

    if (ordersResult.rows.length === 0) {
      return res.json({ data: [] });
    }

    const orderIds = ordersResult.rows.map((r) => r.id);
    const itemsResult = await pool.query(
      `SELECT order_id, product_name, unit_price, quantity, is_sliced, line_total
       FROM order_items
       WHERE order_id = ANY($1::uuid[])
       ORDER BY id ASC`,
      [orderIds],
    );

    const itemsByOrderId = {};
    for (const item of itemsResult.rows) {
      if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
      itemsByOrderId[item.order_id].push(
        normalizeDecimalFields(item, ["unit_price", "line_total"]),
      );
    }

    const timeZone = resolveTimeZone(req);
    return res.json({
      data: ordersResult.rows.map((order) => ({
        ...normalizeDecimalFields(order, ["total_amount"]),
        schedule_date: formatDateInTimeZone(order.schedule_date, timeZone),
        pickup_time: formatTimeToHHmm(order.pickup_time),
        pickup_method: String(order.pickup_method || "").toLowerCase(),
        items: itemsByOrderId[order.id] || [],
      })),
    });
  } catch (error) {
    console.error("GET /shop/:slug/orders error:", error.message);
    return res.status(500).json({ message: "取得訂單列表失敗" });
  }
}

// ────────────────────────────────────────────────────────────
// GET /shop/:slug/orders/:orderNo?phone=xxx
// 客人查詢訂單（用電話驗證）
// ────────────────────────────────────────────────────────────
async function getOrderByNo(req, res) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const orderNo = String(req.params.orderNo || "").trim();
    const phone = String(req.query.phone || "").trim();

    if (!phone) {
      return res.status(400).json({ message: "查詢時必須提供 phone 參數" });
    }

    const userId = await resolveShopUserId(slug);
    if (!userId) {
      return res.status(404).json({ message: "找不到商店" });
    }

    const orderResult = await pool.query(
      `SELECT o.id, o.order_no, o.status, o.customer_name, o.customer_phone,
              o.customer_address, o.pickup_time, o.pickup_method, o.bring_own_bag,
              o.note, o.payment_method, o.total_amount,
              s.schedule_date::text AS schedule_date,
              s.venue_name, s.venue_address, TO_CHAR(s.venue_start, 'HH24:MI') AS venue_start, TO_CHAR(s.venue_end, 'HH24:MI') AS venue_end,
              (s.venue_name IS NOT NULL) AS is_venue
       FROM orders o
       JOIN schedules s ON s.id = o.schedule_id
       WHERE o.user_id = $1
         AND o.order_no = $2
         AND o.customer_phone = $3`,
      [userId, orderNo, phone],
    );

    const order = orderResult.rows[0];
    if (!order) {
      return res.status(404).json({ message: "找不到訂單" });
    }

    const itemsResult = await pool.query(
      `SELECT product_name, unit_price, quantity, is_sliced, line_total
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [order.id],
    );

    const timeZone = resolveTimeZone(req);
    return res.json({
      ...normalizeDecimalFields(order, ["total_amount"]),
      schedule_date: formatDateInTimeZone(order.schedule_date, timeZone),
      pickup_time: formatTimeToHHmm(order.pickup_time),
      pickup_method: String(order.pickup_method || "").toLowerCase(),
      items: itemsResult.rows.map((item) =>
        normalizeDecimalFields(item, ["unit_price", "line_total"]),
      ),
    });
  } catch (error) {
    console.error("GET /shop/:slug/orders/:orderNo error:", error.message);
    return res.status(500).json({ message: "取得訂單失敗" });
  }
}

module.exports = {
  getShopInfo,
  listSchedules,
  getScheduleByDate,
  listCategories,
  listProducts,
  listOrdersByPhone,
  createOrder,
  getOrderByNo,
};
