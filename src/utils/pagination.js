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

function resolvePagination(source = {}) {
  const hasPagination = source.page != null || source.limit != null;
  if (!hasPagination) {
    return { hasPagination, page: 1, limit: null, offset: 0 };
  }
  const { page, limit, offset } = parsePagination(source);
  return { hasPagination, page, limit, offset };
}

function buildListPaginationMeta({ page, limit, total, hasPagination }) {
  const effectiveLimit = hasPagination ? limit : total || 1;
  return buildPaginationMeta({ page, limit: effectiveLimit, total });
}

module.exports = {
  parsePagination,
  buildPaginationMeta,
  resolvePagination,
  buildListPaginationMeta,
};
