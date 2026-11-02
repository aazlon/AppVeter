function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);

    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    return { page, limit, offset: (page - 1) * limit };
}

function buildPagination(total, page, limit) {
    return {
        page,
        limit,
        total: Number(total) || 0,
        totalPages: Math.max(1, Math.ceil((Number(total) || 0) / limit))
    };
}

module.exports = { parsePagination, buildPagination };
