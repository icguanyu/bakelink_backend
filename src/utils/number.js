function normalizeDecimal(value) {
  if (value == null) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value) : value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return value;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed;
}

function normalizeDecimalFields(row, fieldNames) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return row;
  }

  const result = { ...row };
  for (const fieldName of fieldNames) {
    if (Object.prototype.hasOwnProperty.call(result, fieldName)) {
      result[fieldName] = normalizeDecimal(result[fieldName]);
    }
  }
  return result;
}

module.exports = {
  normalizeDecimal,
  normalizeDecimalFields,
};
