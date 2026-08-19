const { pool } = require("../db");
const { pushMessage, buildOrderNotification } = require("../services/lineNotify");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");
const {
  resolveTimeZone,
  formatDateInTimeZone,
  formatTimeToHHmm,
} = require("../utils/datetime");
const { normalizeDecimalFields } = require("../utils/number");

const ORDER_STATUSES = new Set(["PLACED", "COMPLETED", "CANCELLED"]);
const PICKUP_METHODS = new Set(["PICKUP", "DELIVERY"]);

function normalizeOrderStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!ORDER_STATUSES.has(status)) {
    return null;
  }
  return status;
}

function normalizeBooleanField(value, fieldName, { defaultValue, allowMissing = false } = {}) {
  if (value == null) {
    if (allowMissing) {
      return { value: undefined };
    }
    return { value: defaultValue };
  }
  if (typeof value !== "boolean") {
    return { error: `${fieldName} 必須為布林值（true/false）` };
  }
  return { value };
}

function normalizePickupMethod(value, { defaultValue = "PICKUP", allowMissing = false } = {}) {
  if (value == null) {
    if (allowMissing) {
      return { value: undefined };
    }
    return { value: defaultValue };
  }

  const raw = String(value).trim();
  const normalized = raw.toUpperCase();
  const aliasMap = {
    PICKUP: "PICKUP",
    SELF_PICKUP: "PICKUP",
    DELIVERY: "DELIVERY",
    "自取": "PICKUP",
    "宅配": "DELIVERY",
  };
  const method = aliasMap[normalized] || aliasMap[raw];
  if (!method || !PICKUP_METHODS.has(method)) {
    return { error: "pickup_method 必須為 PICKUP 或 DELIVERY" };
  }
  return { value: method };
}

function normalizeOrderItemInput(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { error: "每筆商品項目必須為物件格式" };
  }

  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "item.quantity 必須為正整數" };
  }

  const scheduleItemId = item.schedule_item_id
    ? String(item.schedule_item_id).trim()
    : "";
  const productId = item.product_id ? String(item.product_id).trim() : "";
  if (!scheduleItemId && !productId) {
    return { error: "item.schedule_item_id 或 item.product_id 為必填" };
  }
  const isSliced = normalizeBooleanField(item.is_sliced, "item.is_sliced", {
    defaultValue: false,
  });
  if (isSliced.error) {
    return { error: isSliced.error };
  }

  return {
    value: {
      schedule_item_id: scheduleItemId || null,
      product_id: productId || null,
      quantity,
      is_sliced: isSliced.value,
    },
  };
}

function mapScheduleDate(row, timeZone) {
  if (!row) {
    return row;
  }

  const pickupMethod = row.pickup_method == null
    ? row.pickup_method
    : String(row.pickup_method).toLowerCase();

  return {
    ...normalizeDecimalFields(row, ["total_amount"]),
    schedule_date: formatDateInTimeZone(row.schedule_date, timeZone),
    pickup_time: formatTimeToHHmm(row.pickup_time),
    pickup_method: pickupMethod,
  };
}

function formatOrderRow(row, timeZone) {
  if (!row) {
    return row;
  }

  const pickupMethod = row.pickup_method == null
    ? row.pickup_method
    : String(row.pickup_method).toLowerCase();

  return {
    ...normalizeDecimalFields(row, ["total_amount"]),
    pickup_time: formatTimeToHHmm(row.pickup_time),
    pickup_method: pickupMethod,
  };
}

function getOrderNoPhonePart(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 0) {
    return "000";
  }
  if (digits.startsWith("0") && digits.length >= 4) {
    return digits.slice(1, 4);
  }
  if (digits.length >= 3) {
    return digits.slice(0, 3);
  }
  return digits.padStart(3, "0");
}

function normalizeCreateOrderPayload(body = {}) {
  const scheduleId = String(body.schedule_id || "").trim();
  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const customerAddress = body.customer_address == null
    ? null
    : String(body.customer_address).trim() || null;
  const paymentMethod = String(body.payment_method || "").trim();
  const note = body.note == null ? null : String(body.note).trim() || null;
  const bringOwnBag = normalizeBooleanField(body.bring_own_bag, "bring_own_bag", {
    defaultValue: false,
  });
  if (bringOwnBag.error) {
    return { error: bringOwnBag.error };
  }
  const pickupMethod = normalizePickupMethod(body.pickup_method, { defaultValue: "PICKUP" });
  if (pickupMethod.error) {
    return { error: pickupMethod.error };
  }

  if (!scheduleId) {
    return { error: "schedule_id 為必填" };
  }
  if (!customerName) {
    return { error: "顧客姓名（customer_name）為必填" };
  }
  if (!customerPhone) {
    return { error: "顧客電話（customer_phone）為必填" };
  }
  if (!paymentMethod) {
    return { error: "付款方式（payment_method）為必填" };
  }
  const pickupTime = String(body.pickup_time || "").trim();
  if (!pickupTime) {
    return { error: "取件時間（pickup_time）為必填" };
  }

  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timePattern.test(pickupTime)) {
    return { error: "pickup_time 格式必須為 HH:mm（例如：12:00）" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "訂單商品（items）為必填且不可為空" };
  }

  const items = [];
  for (const item of body.items) {
    const normalized = normalizeOrderItemInput(item);
    if (normalized.error) {
      return { error: normalized.error };
    }
    items.push(normalized.value);
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
      bring_own_bag: bringOwnBag.value,
      pickup_method: pickupMethod.value,
      items,
    },
  };
}

function normalizeUpdateOrderPayload(body = {}) {
  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const customerAddress = body.customer_address == null
    ? null
    : String(body.customer_address).trim() || null;
  const paymentMethod = String(body.payment_method || "").trim();
  const note = body.note == null ? null : String(body.note).trim() || null;
  const bringOwnBag = normalizeBooleanField(body.bring_own_bag, "bring_own_bag", {
    allowMissing: true,
  });
  if (bringOwnBag.error) {
    return { error: bringOwnBag.error };
  }
  const pickupMethod = normalizePickupMethod(body.pickup_method, { allowMissing: true });
  if (pickupMethod.error) {
    return { error: pickupMethod.error };
  }

  if (!customerName) {
    return { error: "顧客姓名（customer_name）為必填" };
  }
  if (!customerPhone) {
    return { error: "顧客電話（customer_phone）為必填" };
  }
  if (!paymentMethod) {
    return { error: "付款方式（payment_method）為必填" };
  }
  const pickupTime = String(body.pickup_time || "").trim();
  if (!pickupTime) {
    return { error: "取件時間（pickup_time）為必填" };
  }

  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timePattern.test(pickupTime)) {
    return { error: "pickup_time 格式必須為 HH:mm（例如：12:00）" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "訂單商品（items）為必填且不可為空" };
  }

  const items = [];
  for (const item of body.items) {
    const normalized = normalizeOrderItemInput(item);
    if (normalized.error) {
      return { error: normalized.error };
    }
    items.push(normalized.value);
  }

  return {
    value: {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      pickup_time: pickupTime,
      note,
      payment_method: paymentMethod,
      bring_own_bag: bringOwnBag.value,
      pickup_method: pickupMethod.value,
      items,
    },
  };
}

async function list(req, res) {
  try {
    const source = req.method === "POST" ? req.body || {} : req.query;
    const { hasPagination, page, limit, offset } = resolvePagination(source);

    const whereClauses = ["o.user_id = $1"];
    const values = [req.user.sub];
    let paramIndex = values.length + 1;

    const scheduleId = source.schedule_id ? String(source.schedule_id).trim() : null;
    if (scheduleId) {
      whereClauses.push(`o.schedule_id = $${paramIndex}`);
      values.push(scheduleId);
      paramIndex += 1;
    }

    const status = source.status ? normalizeOrderStatus(source.status) : null;
    if (source.status && !status) {
      return res.status(400).json({ message: "status 必須為 PLACED、COMPLETED 或 CANCELLED 其中之一" });
    }
    if (status) {
      whereClauses.push(`o.status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }

    const dateFrom = source.date_from ? String(source.date_from).trim() : null;
    const dateTo = source.date_to ? String(source.date_to).trim() : null;
    if (dateFrom) {
      whereClauses.push(`s.schedule_date >= $${paramIndex}`);
      values.push(dateFrom);
      paramIndex += 1;
    }
    if (dateTo) {
      whereClauses.push(`s.schedule_date <= $${paramIndex}`);
      values.push(dateTo);
      paramIndex += 1;
    }

    const whereSql = whereClauses.join(" AND ");

    let total = 0;
    let result;
    if (hasPagination) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}`,
        values,
      );
      total = countResult.rows[0]?.total || 0;

      result = await pool.query(
        `SELECT o.id, o.order_no, o.schedule_id, s.schedule_date::text AS schedule_date,
                s.venue_name, s.venue_address, TO_CHAR(s.venue_start, 'HH24:MI') AS venue_start, TO_CHAR(s.venue_end, 'HH24:MI') AS venue_end,
                o.status, o.customer_name, o.customer_phone,
                o.customer_address,
                o.pickup_time, o.note, o.payment_method, o.bring_own_bag, o.pickup_method, o.total_amount
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}
         ORDER BY o.id DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT o.id, o.order_no, o.schedule_id, s.schedule_date::text AS schedule_date,
                s.venue_name, s.venue_address, TO_CHAR(s.venue_start, 'HH24:MI') AS venue_start, TO_CHAR(s.venue_end, 'HH24:MI') AS venue_end,
                o.status, o.customer_name, o.customer_phone,
                o.customer_address,
                o.pickup_time, o.note, o.payment_method, o.bring_own_bag, o.pickup_method, o.total_amount
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}
         ORDER BY o.id DESC`,
        values,
      );
      total = result.rows.length;
    }

    const timeZone = resolveTimeZone(req);
    const data = result.rows.map((row) => mapScheduleDate(row, timeZone));
    return res.json({
      data,
      pagination: buildListPaginationMeta({ page, limit, total, hasPagination }),
    });
  } catch (error) {
    console.error("POST /orders/list error:", error.message);
    return res.status(500).json({ message: "取得訂單列表失敗", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const orderResult = await pool.query(
      `SELECT o.id, o.order_no, o.user_id, o.schedule_id, s.schedule_date::text AS schedule_date,
              s.venue_name, s.venue_address, TO_CHAR(s.venue_start, 'HH24:MI') AS venue_start, TO_CHAR(s.venue_end, 'HH24:MI') AS venue_end,
              o.status, o.customer_name, o.customer_phone,
              o.customer_address,
              o.pickup_time, o.note, o.payment_method, o.bring_own_bag, o.pickup_method, o.total_amount
       FROM orders o
       JOIN schedules s ON s.id = o.schedule_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: "找不到訂單" });
    }

    const itemResult = await pool.query(
      `SELECT id, schedule_item_id, product_id, product_name, unit_price, quantity, is_sliced, line_total
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [req.params.id],
    );

    const timeZone = resolveTimeZone(req);
    return res.json({
      ...mapScheduleDate(orderResult.rows[0], timeZone),
      items: itemResult.rows.map((item) =>
        normalizeDecimalFields(item, ["unit_price", "line_total"]),
      ),
    });
  } catch (error) {
    console.error("GET /orders/:id error:", error.message);
    return res.status(500).json({ message: "取得訂單失敗", error: error.message });
  }
}

async function create(req, res) {
  const normalized = normalizeCreateOrderPayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const scheduleResult = await client.query(
      `SELECT id, status, schedule_date::text AS schedule_date
       FROM schedules
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [payload.schedule_id, req.user.sub],
    );
    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到排程" });
    }
    if (schedule.status !== "OPEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "只有排程狀態為 OPEN 時才能建立訂單" });
    }

    const orderDate = String(schedule.schedule_date || "").replace(/-/g, "");
    if (!/^\d{8}$/.test(orderDate)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "排程日期無效，無法產生訂單編號" });
    }
    const orderNoPhonePart = getOrderNoPhonePart(payload.customer_phone);

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${req.user.sub}:${orderDate}`],
    );
    const sequenceResult = await client.query(
      `SELECT (COUNT(*) + 1)::int AS next_sequence
       FROM orders
       WHERE user_id = $1
         AND schedule_id IN (
           SELECT id
           FROM schedules
           WHERE user_id = $1
             AND schedule_date = $2::date
         )`,
      [req.user.sub, schedule.schedule_date],
    );
    const nextSequence = sequenceResult.rows[0]?.next_sequence || 1;
    const orderNo = `${orderNoPhonePart}-${orderDate}-${String(nextSequence).padStart(3, "0")}`;

    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, order_no, schedule_id, status, customer_name, customer_phone, customer_address, pickup_time, note, payment_method, bring_own_bag, pickup_method, total_amount
       ) VALUES ($1, $2, $3, 'PLACED', $4, $5, $6, $7, $8, $9, $10, $11, 0)
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 customer_address, note, payment_method, bring_own_bag, pickup_method, total_amount`,
      [
        req.user.sub,
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
    for (const item of payload.items) {
      const keySql = item.schedule_item_id
        ? "si.id = $2"
        : "si.product_id = $2";
      const keyValue = item.schedule_item_id || item.product_id;

      const scheduleItemResult = await client.query(
        `SELECT si.id, si.schedule_id, si.product_id, si.product_name, si.unit_price, si.sales_limit,
                p.is_sliceable, p.slice_price
         FROM schedule_items si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.schedule_id = $1 AND ${keySql}
         FOR UPDATE OF si`,
        [payload.schedule_id, keyValue],
      );
      const scheduleItem = scheduleItemResult.rows[0];
      if (!scheduleItem) {
        throw new Error("SCHEDULE_ITEM_NOT_FOUND");
      }

      if (Number(scheduleItem.sales_limit) > 0) {
        const soldResult = await client.query(
          `SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold_qty
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.schedule_item_id = $1
             AND o.status IN ('PLACED', 'COMPLETED')`,
          [scheduleItem.id],
        );
        const soldQty = soldResult.rows[0]?.sold_qty || 0;
        if (soldQty + item.quantity > scheduleItem.sales_limit) {
          throw new Error("SALES_LIMIT_EXCEEDED");
        }
      }

      const effectivePrice =
        item.is_sliced && scheduleItem.is_sliceable && scheduleItem.slice_price != null
          ? Number(scheduleItem.slice_price)
          : Number(scheduleItem.unit_price);
      const lineTotal = effectivePrice * item.quantity;
      totalAmount += lineTotal;

      await client.query(
        `INSERT INTO order_items (
           order_id, schedule_item_id, product_id, product_name, unit_price, quantity, is_sliced, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          scheduleItem.id,
          scheduleItem.product_id,
          scheduleItem.product_name,
          effectivePrice,
          item.quantity,
          item.is_sliced,
          lineTotal,
        ],
      );
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders
       SET total_amount = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 customer_address, note, payment_method, bring_own_bag, pickup_method, total_amount`,
      [totalAmount, order.id],
    );

    await client.query("COMMIT");

    // Push LINE notification — fire-and-forget, never block the response
    const lineResult = await pool.query(
      `SELECT line_user_id FROM users WHERE id = $1`,
      [req.user.sub],
    );
    const lineUserId = lineResult.rows[0]?.line_user_id;
    if (lineUserId) {
      pushMessage(lineUserId, buildOrderNotification(updatedOrderResult.rows[0])).catch((err) =>
        console.error("[LINE notify error]", err.message),
      );
    }

    const timeZone = resolveTimeZone(req);
    return res.status(201).json(formatOrderRow(updatedOrderResult.rows[0], timeZone));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "SCHEDULE_ITEM_NOT_FOUND") {
      return res.status(400).json({ message: "部分訂單商品不在此排程中" });
    }
    if (error.message === "SALES_LIMIT_EXCEEDED") {
      return res.status(409).json({ message: "一或多項商品已超過銷售數量上限" });
    }
    console.error("POST /orders error:", error.message);
    return res.status(500).json({ message: "建立訂單失敗", error: error.message });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const normalized = normalizeUpdateOrderPayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, user_id, schedule_id, status, bring_own_bag, pickup_method
       FROM orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.sub],
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到訂單" });
    }
    if (order.status !== "PLACED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "只有狀態為 PLACED 的訂單才能修改" });
    }

    const scheduleResult = await client.query(
      `SELECT id, status
       FROM schedules
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [order.schedule_id, req.user.sub],
    );
    const schedule = scheduleResult.rows[0];
    if (!schedule) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到排程" });
    }
    if (schedule.status !== "OPEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "只有排程狀態為 OPEN 時才能修改訂單" });
    }

    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [order.id]);

    let totalAmount = 0;
    for (const item of payload.items) {
      const keySql = item.schedule_item_id
        ? "si.id = $2"
        : "si.product_id = $2";
      const keyValue = item.schedule_item_id || item.product_id;

      const scheduleItemResult = await client.query(
        `SELECT si.id, si.schedule_id, si.product_id, si.product_name, si.unit_price, si.sales_limit,
                p.is_sliceable, p.slice_price
         FROM schedule_items si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.schedule_id = $1 AND ${keySql}
         FOR UPDATE OF si`,
        [order.schedule_id, keyValue],
      );
      const scheduleItem = scheduleItemResult.rows[0];
      if (!scheduleItem) {
        throw new Error("SCHEDULE_ITEM_NOT_FOUND");
      }

      if (Number(scheduleItem.sales_limit) > 0) {
        const soldResult = await client.query(
          `SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold_qty
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.schedule_item_id = $1
             AND o.status IN ('PLACED', 'COMPLETED')
             AND o.id <> $2`,
          [scheduleItem.id, order.id],
        );
        const soldQty = soldResult.rows[0]?.sold_qty || 0;
        if (soldQty + item.quantity > scheduleItem.sales_limit) {
          throw new Error("SALES_LIMIT_EXCEEDED");
        }
      }

      const effectivePrice =
        item.is_sliced && scheduleItem.is_sliceable && scheduleItem.slice_price != null
          ? Number(scheduleItem.slice_price)
          : Number(scheduleItem.unit_price);
      const lineTotal = effectivePrice * item.quantity;
      totalAmount += lineTotal;

      await client.query(
        `INSERT INTO order_items (
           order_id, schedule_item_id, product_id, product_name, unit_price, quantity, is_sliced, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          scheduleItem.id,
          scheduleItem.product_id,
          scheduleItem.product_name,
          effectivePrice,
          item.quantity,
          item.is_sliced,
          lineTotal,
        ],
      );
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders
       SET customer_name = $1,
           customer_phone = $2,
           customer_address = $3,
           pickup_time = $4,
           note = $5,
           payment_method = $6,
           bring_own_bag = $7,
           pickup_method = $8,
           total_amount = $9,
           updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 customer_address, note, payment_method, bring_own_bag, pickup_method, total_amount`,
      [
        payload.customer_name,
        payload.customer_phone,
        payload.customer_address,
        payload.pickup_time,
        payload.note,
        payload.payment_method,
        payload.bring_own_bag ?? order.bring_own_bag,
        payload.pickup_method ?? order.pickup_method,
        totalAmount,
        order.id,
        req.user.sub,
      ],
    );

    await client.query("COMMIT");
    const timeZone = resolveTimeZone(req);
    return res.json(formatOrderRow(updatedOrderResult.rows[0], timeZone));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "SCHEDULE_ITEM_NOT_FOUND") {
      return res.status(400).json({ message: "部分訂單商品不在此排程中" });
    }
    if (error.message === "SALES_LIMIT_EXCEEDED") {
      return res.status(409).json({ message: "一或多項商品已超過銷售數量上限" });
    }
    console.error("PUT /orders/:id error:", error.message);
    return res.status(500).json({ message: "更新訂單失敗", error: error.message });
  } finally {
    client.release();
  }
}

async function updateStatus(req, res) {
  const status = normalizeOrderStatus(req.body?.status);
  if (!status) {
    return res.status(400).json({ message: "status 必須為 PLACED、COMPLETED 或 CANCELLED 其中之一" });
  }

  try {
    const result = await pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 customer_address, note, payment_method, bring_own_bag, pickup_method, total_amount`,
      [status, req.params.id, req.user.sub],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到訂單" });
    }
    const timeZone = resolveTimeZone(req);
    return res.json(formatOrderRow(result.rows[0], timeZone));
  } catch (error) {
    console.error("PUT /orders/:id/status error:", error.message);
    return res.status(500).json({ message: "更新訂單狀態失敗", error: error.message });
  }
}

async function remove(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM orders
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.sub],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "找不到訂單" });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("DELETE /orders/:id error:", error.message);
    return res.status(500).json({ message: "刪除訂單失敗", error: error.message });
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  remove,
};
