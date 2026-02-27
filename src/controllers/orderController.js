const { pool } = require("../db");
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

function normalizeOrderStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!ORDER_STATUSES.has(status)) {
    return null;
  }
  return status;
}

function normalizeOrderItemInput(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { error: "each item must be an object" };
  }

  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "item.quantity must be a positive integer" };
  }

  const scheduleItemId = item.schedule_item_id
    ? String(item.schedule_item_id).trim()
    : "";
  const productId = item.product_id ? String(item.product_id).trim() : "";
  if (!scheduleItemId && !productId) {
    return { error: "item.schedule_item_id or item.product_id is required" };
  }

  return {
    value: {
      schedule_item_id: scheduleItemId || null,
      product_id: productId || null,
      quantity,
    },
  };
}

function mapScheduleDate(row, timeZone) {
  if (!row) {
    return row;
  }

  return {
    ...normalizeDecimalFields(row, ["total_amount"]),
    schedule_date: formatDateInTimeZone(row.schedule_date, timeZone),
    pickup_time: formatTimeToHHmm(row.pickup_time),
  };
}

function formatOrderRow(row, timeZone) {
  if (!row) {
    return row;
  }

  return {
    ...normalizeDecimalFields(row, ["total_amount"]),
    pickup_time: formatTimeToHHmm(row.pickup_time),
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
  const paymentMethod = String(body.payment_method || "").trim();
  const note = body.note == null ? null : String(body.note).trim() || null;

  if (!scheduleId) {
    return { error: "schedule_id is required" };
  }
  if (!customerName) {
    return { error: "customer_name is required" };
  }
  if (!customerPhone) {
    return { error: "customer_phone is required" };
  }
  if (!paymentMethod) {
    return { error: "payment_method is required" };
  }
  const pickupTime = String(body.pickup_time || "").trim();
  if (!pickupTime) {
    return { error: "pickup_time is required" };
  }

  // 驗證 HH:mm 格式 (例如 "09:30", "14:00")
  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timePattern.test(pickupTime)) {
    return { error: "pickup_time must be in HH:mm format (e.g., 12:00)" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "items is required and must not be empty" };
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
      pickup_time: pickupTime,
      note,
      payment_method: paymentMethod,
      items,
    },
  };
}

function normalizeUpdateOrderPayload(body = {}) {
  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const paymentMethod = String(body.payment_method || "").trim();
  const note = body.note == null ? null : String(body.note).trim() || null;

  if (!customerName) {
    return { error: "customer_name is required" };
  }
  if (!customerPhone) {
    return { error: "customer_phone is required" };
  }
  if (!paymentMethod) {
    return { error: "payment_method is required" };
  }
  const pickupTime = String(body.pickup_time || "").trim();
  if (!pickupTime) {
    return { error: "pickup_time is required" };
  }

  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timePattern.test(pickupTime)) {
    return { error: "pickup_time must be in HH:mm format (e.g., 12:00)" };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "items is required and must not be empty" };
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
      pickup_time: pickupTime,
      note,
      payment_method: paymentMethod,
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
      return res.status(400).json({ message: "status must be one of PLACED, COMPLETED, CANCELLED" });
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
        `SELECT o.id, o.order_no, o.schedule_id, s.schedule_date::text AS schedule_date, o.status, o.customer_name, o.customer_phone,
                o.pickup_time, o.note, o.payment_method, o.total_amount
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}
         ORDER BY o.id DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT o.id, o.order_no, o.schedule_id, s.schedule_date::text AS schedule_date, o.status, o.customer_name, o.customer_phone,
                o.pickup_time, o.note, o.payment_method, o.total_amount
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
    return res.status(500).json({ message: "Failed to list orders", error: error.message });
  }
}

async function getById(req, res) {
  try {
    const orderResult = await pool.query(
      `SELECT o.id, o.order_no, o.user_id, o.schedule_id, s.schedule_date::text AS schedule_date, o.status, o.customer_name, o.customer_phone,
              o.pickup_time, o.note, o.payment_method, o.total_amount
       FROM orders o
       JOIN schedules s ON s.id = o.schedule_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: "Order not found" });
    }

    const itemResult = await pool.query(
      `SELECT id, schedule_item_id, product_id, product_name, unit_price, quantity, line_total
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
    return res.status(500).json({ message: "Failed to fetch order", error: error.message });
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
      return res.status(404).json({ message: "Schedule not found" });
    }
    if (schedule.status !== "OPEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Orders can only be created when schedule status is OPEN" });
    }

    const orderDate = String(schedule.schedule_date || "").replace(/-/g, "");
    if (!/^\d{8}$/.test(orderDate)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid schedule date for order number generation" });
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
         user_id, order_no, schedule_id, status, customer_name, customer_phone, pickup_time, note, payment_method, total_amount
       ) VALUES ($1, $2, $3, 'PLACED', $4, $5, $6, $7, $8, 0)
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount`,
      [
        req.user.sub,
        orderNo,
        payload.schedule_id,
        payload.customer_name,
        payload.customer_phone,
        payload.pickup_time,
        payload.note,
        payload.payment_method,
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
        `SELECT si.id, si.schedule_id, si.product_id, si.product_name, si.unit_price, si.sales_limit
         FROM schedule_items si
         WHERE si.schedule_id = $1 AND ${keySql}
         FOR UPDATE`,
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

      const lineTotal = Number(scheduleItem.unit_price) * item.quantity;
      totalAmount += lineTotal;

      await client.query(
        `INSERT INTO order_items (
           order_id, schedule_item_id, product_id, product_name, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          scheduleItem.id,
          scheduleItem.product_id,
          scheduleItem.product_name,
          scheduleItem.unit_price,
          item.quantity,
          lineTotal,
        ],
      );
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders
       SET total_amount = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount`,
      [totalAmount, order.id],
    );

    await client.query("COMMIT");
    const timeZone = resolveTimeZone(req);
    return res.status(201).json(formatOrderRow(updatedOrderResult.rows[0], timeZone));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "SCHEDULE_ITEM_NOT_FOUND") {
      return res.status(400).json({ message: "Some order items are not in schedule" });
    }
    if (error.message === "SALES_LIMIT_EXCEEDED") {
      return res.status(409).json({ message: "Sales limit exceeded for one or more items" });
    }
    console.error("POST /orders error:", error.message);
    return res.status(500).json({ message: "Failed to create order", error: error.message });
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
      `SELECT id, user_id, schedule_id, status
       FROM orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.sub],
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== "PLACED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Only PLACED orders can be edited" });
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
      return res.status(404).json({ message: "Schedule not found" });
    }
    if (schedule.status !== "OPEN") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Orders can only be edited when schedule status is OPEN" });
    }

    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [order.id]);

    let totalAmount = 0;
    for (const item of payload.items) {
      const keySql = item.schedule_item_id
        ? "si.id = $2"
        : "si.product_id = $2";
      const keyValue = item.schedule_item_id || item.product_id;

      const scheduleItemResult = await client.query(
        `SELECT si.id, si.schedule_id, si.product_id, si.product_name, si.unit_price, si.sales_limit
         FROM schedule_items si
         WHERE si.schedule_id = $1 AND ${keySql}
         FOR UPDATE`,
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

      const lineTotal = Number(scheduleItem.unit_price) * item.quantity;
      totalAmount += lineTotal;

      await client.query(
        `INSERT INTO order_items (
           order_id, schedule_item_id, product_id, product_name, unit_price, quantity, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          scheduleItem.id,
          scheduleItem.product_id,
          scheduleItem.product_name,
          scheduleItem.unit_price,
          item.quantity,
          lineTotal,
        ],
      );
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders
       SET customer_name = $1,
           customer_phone = $2,
           pickup_time = $3,
           note = $4,
           payment_method = $5,
           total_amount = $6,
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount`,
      [
        payload.customer_name,
        payload.customer_phone,
        payload.pickup_time,
        payload.note,
        payload.payment_method,
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
      return res.status(400).json({ message: "Some order items are not in schedule" });
    }
    if (error.message === "SALES_LIMIT_EXCEEDED") {
      return res.status(409).json({ message: "Sales limit exceeded for one or more items" });
    }
    console.error("PUT /orders/:id error:", error.message);
    return res.status(500).json({ message: "Failed to update order", error: error.message });
  } finally {
    client.release();
  }
}

async function updateStatus(req, res) {
  const status = normalizeOrderStatus(req.body?.status);
  if (!status) {
    return res.status(400).json({ message: "status must be one of PLACED, COMPLETED, CANCELLED" });
  }

  try {
    const result = await pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, order_no, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount`,
      [status, req.params.id, req.user.sub],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Order not found" });
    }
    const timeZone = resolveTimeZone(req);
    return res.json(formatOrderRow(result.rows[0], timeZone));
  } catch (error) {
    console.error("PUT /orders/:id/status error:", error.message);
    return res.status(500).json({ message: "Failed to update order status", error: error.message });
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
      return res.status(404).json({ message: "Order not found" });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("DELETE /orders/:id error:", error.message);
    return res.status(500).json({ message: "Failed to delete order", error: error.message });
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
