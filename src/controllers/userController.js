const { pool } = require("../db");
const { formatTimeToHHmm } = require("../utils/datetime");
const { normalizeDecimalFields } = require("../utils/number");

function normalizeNullableString(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    return { error: `${fieldName} must be an array of strings` };
  }
  const items = value.map((item) => String(item || "").trim());
  if (items.some((item) => !item)) {
    return { error: `${fieldName} cannot contain empty values` };
  }
  return { value: items };
}

function normalizeNullableNumber(value, fieldName) {
  if (value == null || value === "") {
    return { value: null };
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return { error: `${fieldName} must be a non-negative number` };
  }
  return { value: num };
}

function normalizeUserSettingsPayload(body = {}, { partial = false } = {}) {
  const result = {};

  if (!partial || body.avatar != null) {
    result.avatar = normalizeNullableString(body.avatar);
  }
  if (!partial || body.shopName != null) {
    result.shop_name = normalizeNullableString(body.shopName);
  }
  if (!partial || body.owner != null) {
    result.owner_name = normalizeNullableString(body.owner);
  }
  if (!partial || body.phone != null) {
    result.phone = normalizeNullableString(body.phone);
  }
  if (!partial || body.email != null) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return { error: "email is required" };
    }
    result.email = email;
  }
  if (!partial || body.address != null) {
    result.address = normalizeNullableString(body.address);
  }
  if (!partial || body.intro != null) {
    result.intro = normalizeNullableString(body.intro);
  }
  if (!partial || body.orderPickupTime != null) {
    const raw = String(body.orderPickupTime || "").trim();
    if (!raw) {
      result.order_pickup_time = null;
    } else if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(raw)) {
      return { error: "orderPickupTime must be HH:mm" };
    } else {
      result.order_pickup_time = raw;
    }
  }
  if (!partial || body.paymentMethods != null) {
    const normalized = normalizeStringArray(body.paymentMethods, "paymentMethods");
    if (normalized.error) {
      return { error: normalized.error };
    }
    result.payment_methods = normalized.value;
  }
  if (!partial || body.pickupMethods != null) {
    const normalized = normalizeStringArray(body.pickupMethods, "pickupMethods");
    if (normalized.error) {
      return { error: normalized.error };
    }
    result.pickup_methods = normalized.value;
  }

  if (!partial || body.shipping != null) {
    if (body.shipping == null) {
      result.shipping_free_threshold = null;
      result.shipping_fee = null;
      result.shipping_note = null;
    } else if (!body.shipping || typeof body.shipping !== "object" || Array.isArray(body.shipping)) {
      return { error: "shipping must be an object" };
    } else {
      if (Object.prototype.hasOwnProperty.call(body.shipping, "freeThreshold")) {
        const normalized = normalizeNullableNumber(body.shipping.freeThreshold, "shipping.freeThreshold");
        if (normalized.error) {
          return { error: normalized.error };
        }
        result.shipping_free_threshold = normalized.value;
      }
      if (Object.prototype.hasOwnProperty.call(body.shipping, "fee")) {
        const normalized = normalizeNullableNumber(body.shipping.fee, "shipping.fee");
        if (normalized.error) {
          return { error: normalized.error };
        }
        result.shipping_fee = normalized.value;
      }
      if (Object.prototype.hasOwnProperty.call(body.shipping, "note")) {
        result.shipping_note = normalizeNullableString(body.shipping.note);
      }
    }
  }

  if (!partial || body.packaging != null) {
    if (body.packaging == null) {
      result.packaging_default_pack = null;
      result.packaging_pack_fee = null;
      result.packaging_eco_discount = null;
      result.packaging_note = null;
    } else if (
      !body.packaging ||
      typeof body.packaging !== "object" ||
      Array.isArray(body.packaging)
    ) {
      return { error: "packaging must be an object" };
    } else {
      if (Object.prototype.hasOwnProperty.call(body.packaging, "defaultPack")) {
        result.packaging_default_pack = normalizeNullableString(body.packaging.defaultPack);
      }
      if (Object.prototype.hasOwnProperty.call(body.packaging, "packFee")) {
        const normalized = normalizeNullableNumber(body.packaging.packFee, "packaging.packFee");
        if (normalized.error) {
          return { error: normalized.error };
        }
        result.packaging_pack_fee = normalized.value;
      }
      if (Object.prototype.hasOwnProperty.call(body.packaging, "ecoDiscount")) {
        const normalized = normalizeNullableNumber(
          body.packaging.ecoDiscount,
          "packaging.ecoDiscount",
        );
        if (normalized.error) {
          return { error: normalized.error };
        }
        result.packaging_eco_discount = normalized.value;
      }
      if (Object.prototype.hasOwnProperty.call(body.packaging, "note")) {
        result.packaging_note = normalizeNullableString(body.packaging.note);
      }
    }
  }

  return { value: result };
}

function mapUserSettingsRow(row) {
  if (!row) {
    return row;
  }
  const normalized = normalizeDecimalFields(row, [
    "shipping_free_threshold",
    "shipping_fee",
    "packaging_pack_fee",
    "packaging_eco_discount",
  ]);

  const toText = (value) => (value == null ? "" : String(value));

  return {
    avatar: toText(normalized.avatar),
    shopName: toText(normalized.shop_name),
    owner: toText(normalized.owner_name),
    phone: toText(normalized.phone),
    email: toText(normalized.email),
    address: toText(normalized.address),
    intro: toText(normalized.intro),
    orderPickupTime: formatTimeToHHmm(normalized.order_pickup_time) || "",
    paymentMethods: normalized.payment_methods || [],
    pickupMethods: normalized.pickup_methods || [],
    shipping: {
      freeThreshold: normalized.shipping_free_threshold ?? null,
      fee: normalized.shipping_fee ?? null,
      note: toText(normalized.shipping_note),
    },
    packaging: {
      defaultPack: toText(normalized.packaging_default_pack),
      packFee: normalized.packaging_pack_fee ?? null,
      ecoDiscount: normalized.packaging_eco_discount ?? null,
      note: toText(normalized.packaging_note),
    },
  };
}

async function list(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, role
       FROM users
       ORDER BY id ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /users error:", error.message);
    res.status(500).json({
      message: "資料庫查詢失敗，請檢查 PostgreSQL 設定。",
      error: error.message,
    });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, role,
              avatar, shop_name, owner_name, address, intro, order_pickup_time,
              payment_methods, pickup_methods,
              shipping_free_threshold, shipping_fee, shipping_note,
              packaging_default_pack, packaging_pack_fee, packaging_eco_discount, packaging_note
       FROM users
       WHERE id = $1`,
      [req.user.sub],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(mapUserSettingsRow(result.rows[0]));
  } catch (error) {
    console.error("GET /users/me error:", error.message);
    res.status(500).json({ message: "Failed to fetch user settings", error: error.message });
  }
}

async function updateMe(req, res) {
  const normalized = normalizeUserSettingsPayload(req.body || {}, { partial: true });
  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }
  const payload = normalized.value;

  const fields = [];
  const values = [];
  let paramIndex = 1;

  const assign = (column, value) => {
    fields.push(`${column} = $${paramIndex++}`);
    values.push(value);
  };

  if (Object.prototype.hasOwnProperty.call(payload, "avatar")) {
    assign("avatar", payload.avatar);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "shop_name")) {
    assign("shop_name", payload.shop_name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "owner_name")) {
    assign("owner_name", payload.owner_name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    assign("phone", payload.phone);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    assign("email", payload.email);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "address")) {
    assign("address", payload.address);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "intro")) {
    assign("intro", payload.intro);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "order_pickup_time")) {
    assign("order_pickup_time", payload.order_pickup_time);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "payment_methods")) {
    assign("payment_methods", payload.payment_methods);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "pickup_methods")) {
    assign("pickup_methods", payload.pickup_methods);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "shipping_free_threshold")) {
    assign("shipping_free_threshold", payload.shipping_free_threshold);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "shipping_fee")) {
    assign("shipping_fee", payload.shipping_fee);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "shipping_note")) {
    assign("shipping_note", payload.shipping_note);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "packaging_default_pack")) {
    assign("packaging_default_pack", payload.packaging_default_pack);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "packaging_pack_fee")) {
    assign("packaging_pack_fee", payload.packaging_pack_fee);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "packaging_eco_discount")) {
    assign("packaging_eco_discount", payload.packaging_eco_discount);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "packaging_note")) {
    assign("packaging_note", payload.packaging_note);
  }

  try {
    let result;
    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      result = await pool.query(
        `UPDATE users
         SET ${fields.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING id, name, phone, email, role,
                   avatar, shop_name, owner_name, address, intro, order_pickup_time,
                   payment_methods, pickup_methods,
                   shipping_free_threshold, shipping_fee, shipping_note,
                   packaging_default_pack, packaging_pack_fee, packaging_eco_discount, packaging_note`,
        [...values, req.user.sub],
      );
    } else {
      result = await pool.query(
        `SELECT id, name, phone, email, role,
                avatar, shop_name, owner_name, address, intro, order_pickup_time,
                payment_methods, pickup_methods,
                shipping_free_threshold, shipping_fee, shipping_note,
                packaging_default_pack, packaging_pack_fee, packaging_eco_discount, packaging_note
         FROM users
         WHERE id = $1`,
        [req.user.sub],
      );
    }

    if (!result.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(mapUserSettingsRow(result.rows[0]));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }
    console.error("PUT /users/me error:", error.message);
    res.status(500).json({ message: "Failed to update user settings", error: error.message });
  }
}

module.exports = { list, getMe, updateMe };
