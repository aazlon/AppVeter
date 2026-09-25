const { pool } = require('../config/Config');

const Cita = {};

const exec = (conn, sql, params) => {
    const target = conn || pool;
    return new Promise((resolve, reject) => {
        target.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
};

Cita.create = async (cita, result, connection = null) => {
    const sql = `
        INSERT INTO citas(
        user_id, nombre_propietario, ci, telefono, direccion, correo_electronico,
        motivo_cita, estado, fecha_solicitud, created_at, updated_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const res = await exec(connection, sql, [
            cita.user_id,
            cita.nombre_propietario,
            cita.ci,
            cita.telefono,
            cita.direccion,
            cita.correo_electronico,
            cita.motivo_cita,
            cita.estado || 'PENDIENTE',
            cita.fecha_solicitud,
            new Date(),
            new Date()
        ]);
        result(null, res.insertId);
    } catch (err) {
        result(err, null);
    }
};

const baseSelect = `
    SELECT
        c.*,
        u.name as user_name,
        u.email as user_email
    FROM citas AS c
    LEFT JOIN users AS u ON c.user_id = u.id
`;

Cita.getAll = (filters, pagination, result) => {
    const { limit, offset } = pagination;
    const where = [];
    const params = [];

    if (filters && filters.estado) {
        where.push('c.estado = ?');
        params.push(filters.estado);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countSql = `SELECT COUNT(*) AS total FROM citas AS c ${whereSql}`;
    const dataSql = `${baseSelect} ${whereSql} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;

    pool.query(countSql, params, (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [...params, limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

Cita.getById = (id, result) => {
    const sql = `${baseSelect} WHERE c.id = ?`;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0]);
    });
};

Cita.updateStatus = async (id, estado, fecha_cita, result, connection = null) => {
    const sql = `
        UPDATE citas
        SET estado = ?, fecha_cita = ?, updated_at = ?
        WHERE id = ?
    `;
    try {
        const res = await exec(connection, sql, [estado, fecha_cita || null, new Date(), id]);
        result(null, res);
    } catch (err) {
        result(err, null);
    }
};

Cita.updateDate = (id, fecha_cita, result) => {
    const sql = `UPDATE citas SET fecha_cita = ?, updated_at = ? WHERE id = ?`;
    pool.query(sql, [fecha_cita, new Date(), id], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

Cita.getByUserId = (userId, pagination, result) => {
    const { limit, offset } = pagination;
    const countSql = `SELECT COUNT(*) AS total FROM citas WHERE user_id = ?`;
    const dataSql = `
        SELECT * FROM citas
        WHERE user_id = ?
        ORDER BY created_at DESC
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

Cita.getAllPending = (pagination, result) => {
    const { limit, offset } = pagination;
    const countSql = `SELECT COUNT(*) AS total FROM citas WHERE estado = 'PENDIENTE'`;
    const dataSql = `${baseSelect} WHERE c.estado = 'PENDIENTE' ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;

    pool.query(countSql, [], (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

Cita.getRecepcionistas = (connection = null) => {
    const sql = `
        SELECT U.id, U.name, U.lastname
        FROM users AS U
        INNER JOIN user_has_roles AS UHR ON UHR.id_user = U.id
        INNER JOIN roles AS R ON UHR.id_rol = R.id
        WHERE R.name = 'RECEPCIONISTA'
    `;
    return exec(connection, sql, []);
};

module.exports = Cita;
