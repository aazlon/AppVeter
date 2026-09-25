const { pool } = require('../config/Config');

const Rol = {};

const exec = (conn, sql, params) => {
    const target = conn || pool;
    return new Promise((resolve, reject) => {
        target.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
};

Rol.create = async (id_user, id_rol, result, connection = null) => {
    try {
        const sql = `
            INSERT INTO user_has_roles(id_user, id_rol, created_at, updated_at)
            VALUES(?, ?, ?, ?)
        `;
        const res = await exec(connection, sql, [id_user, id_rol, new Date(), new Date()]);
        result(null, res.insertId);
    } catch (err) {
        result(err, null);
    }
};

Rol.getRolesByUserId = (userId, connection = null) => {
    const sql = `
        SELECT R.id, R.name
        FROM user_has_roles AS UHR
        INNER JOIN roles AS R ON R.id = UHR.id_rol
        WHERE UHR.id_user = ?
    `;
    return exec(connection, sql, [userId]);
};

module.exports = Rol;
