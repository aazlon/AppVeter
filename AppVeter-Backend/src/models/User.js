const { pool } = require('../config/Config');
const bcrypt = require('bcrypt');

const User = {};

const exec = (conn, sql, params) => {
    const target = conn || pool;
    return new Promise((resolve, reject) => {
        target.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
};

User.create = async (user, result, connection = null) => {
    try {
        const hash = await bcrypt.hash(user.password, 10);
        const sql = `
            INSERT INTO users(
            username, email, cedula, name, lastname, phone, image, password, direccion, created_at, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const res = await exec(connection, sql, [
            user.username,
            user.email,
            user.cedula,
            user.name,
            user.lastname,
            user.phone,
            user.image || null,
            hash,
            user.direccion || null,
            new Date(),
            new Date()
        ]);
        result(null, res.insertId);
    } catch (err) {
        result(err, null);
    }
};

User.findById = (id, result) => {
    const sql = `
        SELECT id, username, email, cedula, name, lastname, image, phone, password, direccion
        FROM users
        WHERE id = ?
    `;
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res[0]);
    });
};

User.findByUsernameOrEmail = (identifier, result) => {
    const sql = `
        SELECT
            U.id, U.username, U.email, U.cedula, U.name, U.lastname, U.image, U.phone, U.password,
            R.id AS rol_id, R.name AS rol_name, R.image AS rol_image, R.route AS rol_route
        FROM users AS U
        INNER JOIN user_has_roles AS UHR ON UHR.id_user = U.id
        INNER JOIN roles AS R ON UHR.id_rol = R.id
        WHERE U.email = ? OR U.username = ?
    `;

    pool.query(sql, [identifier, identifier], (err, res) => {
        if (err) {
            result(err, null);
            return;
        }
        if (res.length === 0) {
            result(null, null);
            return;
        }

        const user = {
            id: res[0].id,
            username: res[0].username,
            email: res[0].email,
            name: res[0].name,
            lastname: res[0].lastname,
            image: res[0].image,
            phone: res[0].phone,
            password: res[0].password,
            roles: res.map(row => ({
                id: row.rol_id ? row.rol_id.toString() : null,
                name: row.rol_name,
                image: row.rol_image,
                route: row.rol_route
            }))
        };
        result(null, user);
    });
};

User.saveResetCode = (email, code, expires, result) => {
    const sql = "UPDATE users SET reset_code = ?, reset_code_expires = ?, reset_code_attempts = 0 WHERE email = ?";
    pool.query(sql, [code, expires, email], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

User.incrementResetAttempts = (email, result) => {
    const sql = "UPDATE users SET reset_code_attempts = COALESCE(reset_code_attempts, 0) + 1 WHERE email = ?";
    pool.query(sql, [email], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

User.invalidateResetCode = (email, result) => {
    const sql = "UPDATE users SET reset_code = NULL, reset_code_expires = NULL, reset_code_attempts = 0 WHERE email = ?";
    pool.query(sql, [email], (err, res) => {
        if (result) {
            if (err) result(err, null);
            else result(null, res);
        }
    });
};

User.findByResetCode = (email, code, result) => {
    const sql = "SELECT id, email, reset_code, reset_code_expires, reset_code_attempts FROM users WHERE email = ? AND reset_code = ?";
    pool.query(sql, [email, code], (err, res) => {
        if (err) result(err, null);
        else result(null, res.length > 0 ? res[0] : null);
    });
};

User.findByEmail = (email, result) => {
    const sql = "SELECT id, email FROM users WHERE email = ?";
    pool.query(sql, [email], (err, res) => {
        if (err) result(err, null);
        else result(null, res.length > 0 ? res[0] : null);
    });
};

User.updatePassword = (id, hashedPassword, result) => {
    const sql = "UPDATE users SET password = ?, reset_code = NULL, reset_code_expires = NULL, reset_code_attempts = 0, updated_at = ? WHERE id = ?";
    pool.query(sql, [hashedPassword, new Date(), id], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

User.getAllByRole = (roleId, pagination, result) => {
    const { limit, offset } = pagination;
    const baseFrom = `
        FROM users AS U
        INNER JOIN user_has_roles AS UHR ON UHR.id_user = U.id
        WHERE UHR.id_rol = ?
    `;
    const countSql = `SELECT COUNT(*) AS total ${baseFrom}`;
    const dataSql = `
        SELECT U.id, U.username, U.email, U.cedula, U.name, U.lastname, U.image, U.phone, U.created_at
        ${baseFrom}
        ORDER BY U.created_at DESC
        LIMIT ? OFFSET ?
    `;

    pool.query(countSql, [roleId], (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [roleId, limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

User.delete = (id, result) => {
    const sql = "DELETE FROM users WHERE id = ?";
    pool.query(sql, [id], (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

User.update = (id, user, result) => {
    const hasImage = user.image !== undefined && user.image !== null;
    const sql = hasImage
        ? `UPDATE users SET username = ?, phone = ?, image = ?, updated_at = ? WHERE id = ?`
        : `UPDATE users SET username = ?, phone = ?, updated_at = ? WHERE id = ?`;
    const params = hasImage
        ? [user.username, user.phone, user.image, new Date(), id]
        : [user.username, user.phone, new Date(), id];

    pool.query(sql, params, (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

module.exports = User;
