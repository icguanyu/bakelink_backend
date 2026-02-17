const { pool } = require("../db");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");
const {
  parseUtcDatetime,
  resolveTimeZone,
  formatDateInTimeZone,
} = require("../utils/datetime");

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
    ...row,
    schedule_date: formatDateInTimeZone(row.schedule_date, timeZone),
  };
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
  if (!body.pickup_time) {
    return { error: "pickup_time is required" };
  }

  const pickupTime = parseUtcDatetime(body.pickup_time);
  if (pickupTime.error) {
    return { error: "pickup_time is invalid datetime" };
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
      pickup_time: pickupTime.value,
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
        `SELECT o.id, o.schedule_id, s.schedule_date, o.status, o.customer_name, o.customer_phone,
                o.pickup_time, o.note, o.payment_method, o.total_amount, o.created_at, o.updated_at
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT o.id, o.schedule_id, s.schedule_date, o.status, o.customer_name, o.customer_phone,
                o.pickup_time, o.note, o.payment_method, o.total_amount, o.created_at, o.updated_at
         FROM orders o
         JOIN schedules s ON s.id = o.schedule_id
         WHERE ${whereSql}
         ORDER BY o.created_at DESC`,
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
      `SELECT o.id, o.user_id, o.schedule_id, s.schedule_date, o.status, o.customer_name, o.customer_phone,
              o.pickup_time, o.note, o.payment_method, o.total_amount, o.created_at, o.updated_at
       FROM orders o
       JOIN schedules s ON s.id = o.schedule_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [req.params.id, req.user.sub],
    );

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: "Order not found" });
    }

    const itemResult = await pool.query(
      `SELECT id, schedule_item_id, product_id, product_name, unit_price, quantity, line_total, created_at, updated_at
       FROM order_items
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [req.params.id],
    );

    const timeZone = resolveTimeZone(req);
    return res.json({
      ...mapScheduleDate(orderResult.rows[0], timeZone),
      items: itemResult.rows,
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
      `SELECT id, status
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

    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, schedule_id, status, customer_name, customer_phone, pickup_time, note, payment_method, total_amount
       ) VALUES ($1, $2, 'PLACED', $3, $4, $5, $6, $7, 0)
       RETURNING id, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount, created_at, updated_at`,
      [
        req.user.sub,
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

      if (scheduleItem.sales_limit != null) {
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
       RETURNING id, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount, created_at, updated_at`,
      [totalAmount, order.id],
    );

    await client.query("COMMIT");
    return res.status(201).json(updatedOrderResult.rows[0]);
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
       RETURNING id, user_id, schedule_id, status, customer_name, customer_phone, pickup_time,
                 note, payment_method, total_amount, created_at, updated_at`,
      [status, req.params.id, req.user.sub],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: "Order not found" });
    }
    return res.json(result.rows[0]);
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
  updateStatus,
  remove,
};
