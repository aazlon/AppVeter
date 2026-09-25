const { pool } = require('../config/Config');

const Service = {};

Service.create = (data, result) => {
    const sql = `
        INSERT INTO services(titulo, descripcion, image, user_id, created_at, updated_at)
        VALUES(?, ?, ?, ?, NOW(), NOW())
    `;
    pool.query(sql, [data.titulo, data.descripcion, data.image || null, data.user_id], (err, res) => {
        if (err) result(err, null);
        else result(null, { id: res.insertId, ...data });
    });
};

Service.getAll = (pagination, result) => {
    const { limit, offset } = pagination;
    const countSql = `SELECT COUNT(*) AS total FROM services`;
    const dataSql = `
        SELECT id, titulo, descripcion, image, user_id, created_at, updated_at
        FROM services
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

Service.getById = (id, result) => {
    const sql = `SELECT id, titulo, descripcion, image, user_id, created_at, updated_at FROM services WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0] || null);
    });
};

Service.update = (id, data, result) => {
    let sql, params;
    if (data.image) {
        sql = `UPDATE services SET titulo = ?, descripcion = ?, image = ?, updated_at = NOW() WHERE id = ?`;
        params = [data.titulo, data.descripcion, data.image, id];
    } else {
        sql = `UPDATE services SET titulo = ?, descripcion = ?, updated_at = NOW() WHERE id = ?`;
        params = [data.titulo, data.descripcion, id];
    }
    pool.query(sql, params, (err, res) => {
        if (err) result(err, null);
        else result(null, res.affectedRows > 0 ? { id, ...data } : null);
    });
};

Service.delete = (id, result) => {
    const sql = `DELETE FROM services WHERE id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res.affectedRows > 0);
    });
};

module.exports = Service;
