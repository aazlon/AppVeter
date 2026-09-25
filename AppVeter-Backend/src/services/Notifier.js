const { getConnectionAsync, queryAsync } = require('../config/Config');
const logger = require('../utils/logger');

const clients = new Map();

const MAX_PER_USER = Number(process.env.SSE_MAX_PER_USER) || 3;
const MAX_PER_IP = Number(process.env.SSE_MAX_PER_IP) || 10;

function pruneDead(set) {
    for (const res of set) {
        if (res.writableEnded || res.destroyed) set.delete(res);
    }
}

function releaseLocal(res, key) {
    const set = clients.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(key);
}

// Reserva una conexión mientras quede aforo. Devuelve false si ya está lleno.
async function reserveConnection(kind, scopeKey, max) {
    const connection = await getConnectionAsync();
    try {
        const result = await queryAsync(
            connection,
            `INSERT INTO sse_counters (kind, scope_key, connections, updated_at)
             VALUES (?, ?, 1, NOW(3))
             ON DUPLICATE KEY UPDATE
                connections = IF(connections < ?, connections + 1, connections),
                updated_at = NOW(3)`,
            [kind, scopeKey, max]
        );
        // affectedRows: 1 insert, 2 actualizado, 0 sin cambio (aforo lleno)
        return Number(result.affectedRows) > 0;
    } finally {
        connection.release();
    }
}

async function releaseConnection(kind, scopeKey) {
    const connection = await getConnectionAsync();
    try {
        await queryAsync(
            connection,
            'UPDATE sse_counters SET connections = GREATEST(connections - 1, 0), updated_at = NOW(3) WHERE kind = ? AND scope_key = ?',
            [kind, scopeKey]
        );
    } finally {
        connection.release();
    }
}

async function subscribe(userId, res, ip) {
    const key = String(userId);
    let userReserved = false;

    try {
        userReserved = await reserveConnection('user', key, MAX_PER_USER);
        if (!userReserved) return { ok: false, reason: 'user' };

        if (ip) {
            const ipReserved = await reserveConnection('ip', ip, MAX_PER_IP);
            if (!ipReserved) {
                await releaseConnection('user', key);
                return { ok: false, reason: 'ip' };
            }
        }
    } catch (error) {
        logger.error({ err: error }, 'Error reservando conexión SSE');
        if (userReserved) {
            await releaseConnection('user', key).catch((err) => logger.error({ err }, 'Error liberando conexión SSE'));
        }
        return { ok: false, reason: 'error' };
    }

    const set = clients.get(key) || new Set();
    pruneDead(set);
    set.add(res);
    clients.set(key, set);

    res.on('close', () => {
        releaseLocal(res, key);
        releaseConnection('user', key).catch((err) => logger.error({ err }, 'Error liberando conexión SSE'));
        if (ip) {
            releaseConnection('ip', ip).catch((err) => logger.error({ err }, 'Error liberando conexión SSE'));
        }
    });

    return { ok: true };
}

function notify(userId, payload) {
    const key = String(userId);
    const set = clients.get(key);
    if (!set) return;
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
        if (res.writableEnded || res.destroyed) {
            set.delete(res);
            continue;
        }
        try {
            res.write(message);
        } catch (err) {
            set.delete(res);
        }
    }
    if (set.size === 0) clients.delete(key);
}

async function stats() {
    let localConnections = 0;
    for (const set of clients.values()) localConnections += set.size;

    try {
        const connection = await getConnectionAsync();
        try {
            const rows = await queryAsync(
                connection,
                'SELECT kind, SUM(connections) AS total FROM sse_counters GROUP BY kind'
            );
            const byKind = {};
            for (const row of rows) byKind[row.kind] = Number(row.total);
            return { users: clients.size, connections: localConnections, db: byKind };
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error({ err: error }, 'Error consultando estadísticas SSE');
        return { users: clients.size, connections: localConnections };
    }
}

module.exports = { subscribe, notify, stats, MAX_PER_USER, MAX_PER_IP };
