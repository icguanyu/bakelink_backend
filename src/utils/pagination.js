function parsePagination(query = {}, options = {}) {
  const defaultPage = options.defaultPage || 1;
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 100;

  const page = Math.max(
    Number.parseInt(query.page, 10) || defaultPage,
    1,
  );
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function buildPaginationMeta({ page, limit, total }) {
  const safeTotal = Number(total) || 0;
  return {
    page,
    limit,
    total: safeTotal,
    total_pages: Math.ceil(safeTotal / limit),
  };
}

module.exports = { parsePagination, buildPaginationMeta };
