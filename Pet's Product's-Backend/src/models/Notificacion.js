const { pool } = require('../config/Config');

const Notificacion = {};

const exec = (conn, sql, params) => {
    const target = conn || pool;
    return new Promise((resolve, reject) => {
        target.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
};

const INSERT_COLS = 8;

Notificacion.create = async (notificacion, result, connection = null) => {
    const sql = `
        INSERT INTO notificaciones(
        user_id, titulo, mensaje, tipo, leida, cita_id, emisor_id, created_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const res = await exec(connection, sql, [
            notificacion.user_id,
            notificacion.titulo,
            notificacion.mensaje,
            notificacion.tipo,
            notificacion.leida || 0,
            notificacion.cita_id || null,
            notificacion.emisor_id || null,
            new Date()
        ]);
        result(null, res.insertId);
    } catch (err) {
        result(err, null);
    }
};

Notificacion.createMany = async (items, connection = null) => {
    if (!items || items.length === 0) return null;
    const placeholders = items.map(() => `(?, ?, ?, ?, ?, ?, ?, ?)`).join(', ');
    const sql = `
        INSERT INTO notificaciones(
        user_id, titulo, mensaje, tipo, leida, cita_id, emisor_id, created_at
        )
        VALUES ${placeholders}
    `;
    const now = new Date();
    const params = [];
    for (const item of items) {
        params.push(
            item.user_id,
            item.titulo,
            item.mensaje,
            item.tipo,
            item.leida || 0,
            item.cita_id || null,
            item.emisor_id || null,
            now
        );
    }
    if (params.length !== items.length * INSERT_COLS) {
        throw new Error('Payload de notificaciones inválido');
    }
    return exec(connection, sql, params);
};

Notificacion.getByUserId = (userId, pagination, result) => {
    const { limit, offset } = pagination;
    const countSql = `SELECT COUNT(*) AS total FROM notificaciones WHERE user_id = ?`;
    const dataSql = `
        SELECT
            N.*,
            E.image AS emisor_image,
            CONCAT(E.name, ' ', E.lastname) AS emisor_nombre
        FROM notificaciones N
        LEFT JOIN users E ON E.id = N.emisor_id
        WHERE N.user_id = ?
        ORDER BY N.created_at DESC
        LIMIT ? OFFSET ?
    `;

    pool.query(countSql, [userId], (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [userId, limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

Notificacion.getById = (id, result) => {
    const sql = `SELECT id, user_id FROM notificaciones WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0] || null);
    });
};

Notificacion.markAsRead = (id, result) => {
    const sql = `UPDATE notificaciones SET leida = 1 WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

Notificacion.markAllAsRead = (userId, result) => {
    const sql = `UPDATE notificaciones SET leida = 1 WHERE user_id = ?`;
    pool.query(sql, [userId], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

Notificacion.delete = (id, result) => {
    const sql = `DELETE FROM notificaciones WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

Notificacion.getUnreadCount = (userId, result) => {
    const sql = `SELECT COUNT(*) as count FROM notificaciones WHERE user_id = ? AND leida = 0`;
    pool.query(sql, [userId], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0].count);
    });
};

module.exports = Notificacion;
