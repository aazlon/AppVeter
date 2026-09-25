const { pool } = require('../config/Config');

const Novedad = {};

Novedad.create = (data, result) => {
    const sql = `
        INSERT INTO novedades(descripcion, image, user_id, created_at, updated_at)
        VALUES(?, ?, ?, NOW(), NOW())
    `;
    pool.query(sql, [data.descripcion, data.image || null, data.user_id], (err, res) => {
        if (err) result(err, null);
        else result(null, { id: res.insertId, ...data });
    });
};

Novedad.getAll = (pagination, result) => {
    const { limit, offset } = pagination;
    const countSql = `SELECT COUNT(*) AS total FROM novedades`;
    const dataSql = `
        SELECT id, descripcion, image, user_id, created_at, updated_at
        FROM novedades
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    pool.query(countSql, [], (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

Novedad.getById = (id, result) => {
    const sql = `SELECT id, descripcion, image, user_id, created_at, updated_at FROM novedades WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0] || null);
    });
};

Novedad.update = (id, data, result) => {
    let sql, params;
    if (data.image) {
        sql = `UPDATE novedades SET descripcion = ?, image = ?, updated_at = NOW() WHERE id = ?`;
        params = [data.descripcion, data.image, id];
    } else {
        sql = `UPDATE novedades SET descripcion = ?, updated_at = NOW() WHERE id = ?`;
        params = [data.descripcion, id];
    }
    pool.query(sql, params, (err, res) => {
        if (err) result(err, null);
        else result(null, res.affectedRows > 0 ? { id, ...data } : null);
    });
};

Novedad.delete = (id, result) => {
    const sql = `DELETE FROM novedades WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res.affectedRows > 0);
    });
};

module.exports = Novedad;
