function parseUtcDatetime(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return { error: "invalid datetime" };
    }
    return { value: input.toISOString() };
  }

  const raw = String(input || "").trim();
  if (!raw) {
    return { error: "invalid datetime" };
  }

  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "invalid datetime" };
  }

  return { value: parsed.toISOString() };
}

function resolveTimeZone(req) {
  const raw = req?.headers?.["x-timezone"];
  const timeZone = typeof raw === "string" && raw.trim() ? raw.trim() : "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch (error) {
    return "UTC";
  }
}

function formatDateInTimeZone(value, timeZone) {
  if (!value) {
    return value;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

module.exports = { parseUtcDatetime, resolveTimeZone, formatDateInTimeZone };
