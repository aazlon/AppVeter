const { getConnectionAsync, queryAsync } = require('../config/Config');
const logger = require('../utils/logger');

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupStarted = false;

function startGlobalCleanup() {
    if (cleanupStarted) return;
    cleanupStarted = true;

    const timer = setInterval(async () => {
        try {
            const conn = await getConnectionAsync();
            try {
                await queryAsync(conn, 'DELETE FROM rate_limits WHERE expires_at < NOW(3)');
            } finally {
                conn.release();
            }
        } catch (err) {
            logger.error({ err }, 'Error limpiando rate_limits caducados');
        }
    }, CLEANUP_INTERVAL_MS);

    if (typeof timer.unref === 'function') timer.unref();
}

class MysqlRateStore {
    constructor({ prefix = 'rl_' } = {}) {
        this.prefix = prefix;
        this.windowMs = 60000;
        this.localKeys = false;
    }

    get windowSeconds() {
        return Math.max(1, Math.round(this.windowMs / 1000));
    }

    prefixKey(key) {
        return `${this.prefix}${key}`;
    }

    async init(options) {
        const windowMs = Number(options && options.windowMs);
        if (Number.isFinite(windowMs) && windowMs > 0) this.windowMs = windowMs;
        startGlobalCleanup();
    }

    async increment(key) {
        const bucket = this.prefixKey(String(key));
        const seconds = this.windowSeconds;
        const connection = await getConnectionAsync();
        try {
            await queryAsync(
                connection,
                `INSERT INTO rate_limits (bucket, window_start, hits, expires_at)
                 VALUES (?, NOW(3), 1, DATE_ADD(NOW(3), INTERVAL ? SECOND))
                 ON DUPLICATE KEY UPDATE
                    hits = IF(expires_at <= NOW(3), 1, hits + 1),
                    window_start = IF(expires_at <= NOW(3), NOW(3), window_start),
                    expires_at = IF(expires_at <= NOW(3), DATE_ADD(NOW(3), INTERVAL ? SECOND), expires_at)`,
                [bucket, seconds, seconds]
            );

            const rows = await queryAsync(
                connection,
                'SELECT hits, expires_at FROM rate_limits WHERE bucket = ?',
                [bucket]
            );
            const row = rows[0];
            if (!row) throw new Error(`No se encontró la fila rate_limits para ${bucket}`);

            return {
                totalHits: Number(row.hits),
                resetTime: new Date(row.expires_at)
            };
        } finally {
            connection.release();
        }
    }

    async decrement(key) {
        const bucket = this.prefixKey(String(key));
        const connection = await getConnectionAsync();
        try {
            await queryAsync(
                connection,
                'UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE bucket = ?',
                [bucket]
            );
        } finally {
            connection.release();
        }
    }

    async get(key) {
        const bucket = this.prefixKey(String(key));
        const connection = await getConnectionAsync();
        try {
            const rows = await queryAsync(
                connection,
                'SELECT hits, expires_at FROM rate_limits WHERE bucket = ? AND expires_at > NOW(3)',
                [bucket]
            );
            const row = rows[0];
            if (!row) return undefined;
            return { totalHits: Number(row.hits), resetTime: new Date(row.expires_at) };
        } finally {
            connection.release();
        }
    }

    async resetKey(key) {
        const bucket = this.prefixKey(String(key));
        const connection = await getConnectionAsync();
        try {
            await queryAsync(connection, 'DELETE FROM rate_limits WHERE bucket = ?', [bucket]);
        } finally {
            connection.release();
        }
    }

    async resetAll() {
        const connection = await getConnectionAsync();
        try {
            await queryAsync(connection, 'DELETE FROM rate_limits WHERE bucket LIKE ?', [`${this.prefix}%`]);
        } finally {
            connection.release();
        }
    }

    shutdown() {
        return Promise.resolve();
    }
}

module.exports = MysqlRateStore;
