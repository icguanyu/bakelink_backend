const { pool } = require("../db");
const {
  resolvePagination,
  buildListPaginationMeta,
} = require("../utils/pagination");
const {
  parseUtcDatetime,
  resolveTimeZone,
  formatDateInTimeZone,
  formatDatetimeInTimeZone,
} = require("../utils/datetime");

const SCHEDULE_STATUSES = new Set(["DRAFT", "ANNOUNCED", "OPEN", "CLOSED", "FULFILLED"]);

function normalizeScheduleStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!SCHEDULE_STATUSES.has(status)) {
    return null;
  }
  return status;
}

function normalizeScheduleItemInput(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { error: "each item must be an object" };
  }

  const productId = String(item.product_id || "").trim();
  if (!productId) {
    return { error: "item.product_id is required" };
  }

  let salesLimit = null;
  if (item.sales_limit != null) {
    const salesLimitNum = Number(item.sales_limit);
    if (!Number.isInteger(salesLimitNum) || salesLimitNum <= 0) {
      return { error: "item.sales_limit must be a positive integer when provided" };
    }
    salesLimit = salesLimitNum;
  }

  return {
    value: {
      product_id: productId,
      sales_limit: salesLimit,
    },
  };
}

function normalizeSchedulePayload(body = {}, { partial = false } = {}) {
  const result = {};

  if (!partial || body.schedule_date != null) {
    if (!body.schedule_date) {
      return { error: "schedule_date is required" };
    }

    const scheduleDate = String(body.schedule_date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
      return { error: "schedule_date must be YYYY-MM-DD" };
    }
    const parsedDate = new Date(`${scheduleDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "schedule_date is invalid date" };
    }
    result.schedule_date = scheduleDate;
  }

  if (!partial || body.order_start_at != null) {
    if (!body.order_start_at) {
      return { error: "order_start_at is required" };
    }
    const startAt = parseUtcDatetime(body.order_start_at);
    if (startAt.error) {
      return { error: "order_start_at is invalid datetime" };
    }
    result.order_start_at = startAt.value;
  }

  if (!partial || body.order_end_at != null) {
    if (!body.order_end_at) {
      return { error: "order_end_at is required" };
    }
    const endAt = parseUtcDatetime(body.order_end_at);
    if (endAt.error) {
      return { error: "order_end_at is invalid datetime" };
    }
    result.order_end_at = endAt.value;
  }

  if (result.order_start_at && result.order_end_at) {
    if (new Date(result.order_start_at).getTime() >= new Date(result.order_end_at).getTime()) {
      return { error: "order_start_at must be earlier than order_end_at" };
    }
  }

  if (body.status != null) {
    const status = normalizeScheduleStatus(body.status);
    if (!status) {
      return { error: "status must be one of DRAFT, ANNOUNCED, OPEN, CLOSED, FULFILLED" };
    }
    result.status = status;
  } else if (!partial) {
    result.status = "DRAFT";
  }

  if (body.note != null) {
    result.note = String(body.note).trim() || null;
  } else if (!partial) {
    result.note = null;
  }

  if (body.items != null) {
    if (!Array.isArray(body.items)) {
      return { error: "items must be an array" };
    }
    const normalizedItems = [];
    const productIdSet = new Set();
    for (const item of body.items) {
      const normalized = normalizeScheduleItemInput(item);
      if (normalized.error) {
        return { error: normalized.error };
      }
      if (productIdSet.has(normalized.value.product_id)) {
        return { error: "items cannot contain duplicated product_id" };
      }
      productIdSet.add(normalized.value.product_id);
      normalizedItems.push(normalized.value);
    }
    result.items = normalizedItems;
  } else if (!partial) {
    result.items = [];
  }

  return { value: result };
}

function mapScheduleDate(row, timeZone) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    schedule_date: formatDateInTimeZone(row.schedule_date, timeZone),
    order_start_at: formatDatetimeInTimeZone(row.order_start_at, timeZone),
    order_end_at: formatDatetimeInTimeZone(row.order_end_at, timeZone),
  };
}

async function upsertScheduleItems(client, userId, scheduleId, items) {
  if (!Array.isArray(items)) {
    return;
  }

  await client.query(`DELETE FROM schedule_items WHERE schedule_id = $1`, [scheduleId]);
  if (items.length === 0) {
    return;
  }

  const productIds = items.map((item) => item.product_id);
  const productResult = await client.query(
    `SELECT id, name, price
     FROM products
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND is_active = TRUE`,
    [userId, productIds],
  );

  if (productResult.rows.length !== productIds.length) {
    throw new Error("SOME_PRODUCTS_NOT_FOUND");
  }

  const productMap = new Map(productResult.rows.map((row) => [row.id, row]));
  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      throw new Error("SOME_PRODUCTS_NOT_FOUND");
    }
    await client.query(
      `INSERT INTO schedule_items (schedule_id, user_id, product_id, product_name, unit_price, sales_limit)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [scheduleId, userId, item.product_id, product.name, product.price, item.sales_limit],
    );
  }
}

async function list(req, res) {
  try {
    const source = req.method === "POST" ? req.body || {} : req.query;
    const { hasPagination, page, limit, offset } = resolvePagination(source);

    const whereClauses = ["s.user_id = $1"];
    const values = [req.user.sub];
    let paramIndex = values.length + 1;

    const date = source.date ? String(source.date).trim() : null;
    const dateFrom = source.date_from ? String(source.date_from).trim() : null;
    const dateTo = source.date_to ? String(source.date_to).trim() : null;
    const month = source.month ? String(source.month).trim() : null;

    if (date) {
      whereClauses.push(`s.schedule_date = $${paramIndex}`);
      values.push(date);
      paramIndex += 1;
    } else {
      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ message: "month must be YYYY-MM" });
        }
        const [yearText, monthText] = month.split("-");
        const year = Number(yearText);
        const monthNum = Number(monthText);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        whereClauses.push(`s.schedule_date >= $${paramIndex}`);
        values.push(start.toISOString().slice(0, 10));
        paramIndex += 1;

        whereClauses.push(`s.schedule_date < $${paramIndex}`);
        values.push(end.toISOString().slice(0, 10));
        paramIndex += 1;
      }
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
    }

    const status = source.status ? normalizeScheduleStatus(source.status) : null;
    if (source.status && !status) {
      return res
        .status(400)
        .json({ message: "status must be one of DRAFT, ANNOUNCED, OPEN, CLOSED, FULFILLED" });
    }
    if (status) {
      whereClauses.push(`s.status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }

    const whereSql = whereClauses.join(" AND ");

    let total = 0;
    let result;
    if (hasPagination) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM schedules s
         WHERE ${whereSql}`,
        values,
      );
      total = countResult.rows[0]?.total || 0;

      result = await pool.query(
        `SELECT s.id, s.schedule_date::text AS schedule_date, s.status, s.order_start_at, s.order_end_at, s.note,
                COUNT(DISTINCT si.id)::int AS item_count,
                COUNT(DISTINCT o.id)::int AS order_count
         FROM schedules s
         LEFT JOIN schedule_items si ON si.schedule_id = s.id
         LEFT JOIN orders o ON o.schedule_id = s.id
         WHERE ${whereSql}
         GROUP BY s.id
         ORDER BY s.schedule_date ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset],
      );
    } else {
      result = await pool.query(
        `SELECT s.id, s.schedule_date::text AS schedule_date, s.status, s.order_start_at, s.order_end_at, s.note,
                COUNT(DISTINCT si.id)::int AS item_count,
                COUNT(DISTINCT o.id)::int AS order_count
         FROM schedules s
         LEFT JOIN schedule_items si ON si.schedule_id = s.id
         LEFT JOIN orders o ON o.schedule_id = s.id
         WHERE ${whereSql}
         GROUP BY s.id
         ORDER BY s.schedule_date ASC`,
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
    console.error("POST /schedules/list error:", error.message);
    return res.status(500).json({ message: "Failed to list schedules", error: error.message });
  }
}

async function listByMonth(req, res) {
  try {
    const month = String(req.params.month || "").trim();
    if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }

    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNum = Number(monthText);
    const start = new Date(Date.UTC(year, monthNum - 1, 1));
    const end = new Date(Date.UTC(year, monthNum, 1));

    const whereClauses = ["s.user_id = $1", "s.schedule_date >= $2", "s.schedule_date < $3"];
    const values = [req.user.sub, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    let paramIndex = values.length + 1;

    const status = req.query.status ? normalizeScheduleStatus(req.query.status) : null;
    if (req.query.status && !status) {
      return res
        .status(400)
        .json({ message: "status must be one of DRAFT, ANNOUNCED, OPEN, CLOSED, FULFILLED" });
    }
    if (status) {
      whereClauses.push(`s.status = $${paramIndex}`);
      values.push(status);
      paramIndex += 1;
    }

    const whereSql = whereClauses.join(" AND ");

    const result = await pool.query(
      `SELECT s.id, s.schedule_date::text AS schedule_date, s.status, s.order_start_at, s.order_end_at, s.note,
              COUNT(DISTINCT si.id)::int AS item_count,
              COUNT(DISTINCT o.id)::int AS order_count
       FROM schedules s
       LEFT JOIN schedule_items si ON si.schedule_id = s.id
       LEFT JOIN orders o ON o.schedule_id = s.id
       WHERE ${whereSql}
       GROUP BY s.id
       ORDER BY s.schedule_date ASC`,
      values,
    );

    const timeZone = resolveTimeZone(req);
    const data = result.rows.map((row) => mapScheduleDate(row, timeZone));
    return res.json({ data });
  } catch (error) {
    console.error("GET /schedules/month/:month error:", error.message);
    return res
      .status(500)
      .json({ message: "Failed to list schedules by month", error: error.message });
  }
}

// 按日期查詢行程詳情
// 根據日期 (YYYY-MM-DD) 取得該天的行程和項目
async function getByDate(req, res) {
  try {
    // 驗證日期格式
    const scheduleDate = req.params.date || String(req.query.date || "").trim();
    if (!scheduleDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD format" });
    }

    // 查詢行程基本資料
    const scheduleResult = await pool.query(
      `SELECT id, user_id, schedule_date::text AS schedule_date, status, order_start_at, order_end_at, note
       FROM schedules
       WHERE schedule_date = $1 AND user_id = $2`,
      [scheduleDate, req.user.sub],
    );

    // 如果沒有資料，回傳 null
    if (!scheduleResult.rows[0]) {
      return res.json(null);
    }

    const scheduleId = scheduleResult.rows[0].id;
    const itemsResult = await pool.query(
      `SELECT id, product_id, product_name, unit_price, sales_limit
       FROM schedule_items
       WHERE schedule_id = $1
       ORDER BY id ASC`,
      [scheduleId],
    );

    const timeZone = resolveTimeZone(req);
    return res.json({
      ...mapScheduleDate(scheduleResult.rows[0], timeZone),
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("GET /schedules/:date error:", error.message);
    return res.status(500).json({ message: "Failed to fetch schedule", error: error.message });
  }
}

async function create(req, res) {
  const normalized = normalizeSchedulePayload(req.body || {});
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const scheduleResult = await client.query(
      `INSERT INTO schedules (user_id, schedule_date, status, order_start_at, order_end_at, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, schedule_date::text AS schedule_date, status, order_start_at, order_end_at, note`,
      [
        req.user.sub,
        payload.schedule_date,
        payload.status,
        payload.order_start_at,
        payload.order_end_at,
        payload.note,
      ],
    );

    const schedule = scheduleResult.rows[0];
    await upsertScheduleItems(client, req.user.sub, schedule.id, payload.items);

    await client.query("COMMIT");
    const timeZone = resolveTimeZone(req);
    return res.status(201).json(mapScheduleDate(schedule, timeZone));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "A schedule already exists on this date" });
    }
    if (error.code === "23514" || error.code === "22007") {
      return res.status(400).json({ message: "Invalid date or ordering time range" });
    }
    if (error.message === "SOME_PRODUCTS_NOT_FOUND") {
      return res.status(400).json({ message: "Some products are invalid or inactive" });
    }
    console.error("POST /schedules error:", error.message);
    return res.status(500).json({ message: "Failed to create schedule", error: error.message });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const normalized = normalizeSchedulePayload(req.body || {}, { partial: true });
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const editableFields = [];
  const values = [];
  let paramIndex = 1;

  if (payload.schedule_date != null) {
    editableFields.push(`schedule_date = $${paramIndex++}`);
    values.push(payload.schedule_date);
  }
  if (payload.status != null) {
    editableFields.push(`status = $${paramIndex++}`);
    values.push(payload.status);
  }
  if (payload.order_start_at != null) {
    editableFields.push(`order_start_at = $${paramIndex++}`);
    values.push(payload.order_start_at);
  }
  if (payload.order_end_at != null) {
    editableFields.push(`order_end_at = $${paramIndex++}`);
    values.push(payload.order_end_at);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "note")) {
    editableFields.push(`note = $${paramIndex++}`);
    values.push(payload.note);
  }
  editableFields.push(`updated_at = NOW()`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let schedule;
    if (editableFields.length > 1) {
      const updateResult = await client.query(
        `UPDATE schedules
         SET ${editableFields.join(", ")}
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING id, user_id, schedule_date::text AS schedule_date, status, order_start_at, order_end_at, note`,
        [...values, req.params.id, req.user.sub],
      );
      schedule = updateResult.rows[0];
    } else {
      const currentResult = await client.query(
      `SELECT id, user_id, schedule_date::text AS schedule_date, status, order_start_at, order_end_at, note
         FROM schedules
         WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.sub],
      );
      schedule = currentResult.rows[0];
    }

    if (!schedule) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (payload.items != null) {
      await upsertScheduleItems(client, req.user.sub, req.params.id, payload.items);
    }

    await client.query("COMMIT");
    const timeZone = resolveTimeZone(req);
    return res.json(mapScheduleDate(schedule, timeZone));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "A schedule already exists on this date" });
    }
    if (error.code === "23514" || error.code === "22007") {
      return res.status(400).json({ message: "Invalid date or ordering time range" });
    }
    if (error.message === "SOME_PRODUCTS_NOT_FOUND") {
      return res.status(400).json({ message: "Some products are invalid or inactive" });
    }
    console.error("PUT /schedules/:id error:", error.message);
    return res.status(500).json({ message: "Failed to update schedule", error: error.message });
  } finally {
    client.release();
  }
}

async function remove(req, res) {
  try {
    const result = await pool.query(
      `DELETE FROM schedules
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({ message: "Schedule already has orders and cannot be deleted" });
    }
    console.error("DELETE /schedules/:id error:", error.message);
    return res.status(500).json({ message: "Failed to delete schedule", error: error.message });
  }
}

module.exports = {
  list,
  listByMonth,
  getByDate,
  create,
  update,
  remove,
};
