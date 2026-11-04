const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pets_products',
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 50,
    waitForConnections: true,
    queueLimit: 200,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Proveedores gestionados (p.ej. Aiven) exigen TLS: actívalo con DB_SSL=true.
    ...(String(process.env.DB_SSL).toLowerCase() === 'true'
        ? { ssl: { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' } }
        : {})
});

pool.on('error', (err) => {
    console.error('Error en pool de conexiones:', err);
});

function getConnectionAsync() {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            else resolve(connection);
        });
    });
}

function queryAsync(connection, sql, params = []) {
    const target = connection || pool;
    return new Promise((resolve, reject) => {
        target.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
}

const splitStatements = (script) => {
    return script
        .split(/;\s*(?:\r?\n|$)/)
        // Quita SOLO las líneas de comentario del statement, no el statement entero
        // (antes un `--` arriba de un CREATE TABLE hacía que se descartara completo).
        .map((s) => s
            .split(/\r?\n/)
            .filter((line) => {
                const t = line.trim();
                return t.length > 0 && !t.startsWith('--') && !t.startsWith('#');
            })
            .join('\n')
            .trim())
        .filter((s) => s.length > 0);
};

const runScript = async (connection, script, ignoreCodes = []) => {
    const statements = splitStatements(script);
    for (const statement of statements) {
        try {
            await queryAsync(connection, statement);
        } catch (err) {
            if (ignoreCodes.includes(err.code || '')) continue;
            throw err;
        }
    }
};

const initializeDatabase = async () => {
    const connection = await getConnectionAsync();
    try {
        const sqlScript = fs.readFileSync(path.join(__dirname, '../db/Db.sql')).toString();
        // Gestionados como Aiven pueden rechazar la creación de tablas hijas con FK
        // (errno 1824) aunque el orden del script sea correcto. Se desactiva la
        // verificación de FKs solo durante el script y se reactiva al terminar.
        await queryAsync(connection, 'SET FOREIGN_KEY_CHECKS = 0');
        // ER_DUP_KEYNAME: el índice ya existe (MySQL no admite CREATE INDEX IF NOT EXISTS).
        await runScript(connection, sqlScript, ['ER_DUP_KEYNAME']);
        await queryAsync(connection, 'SET FOREIGN_KEY_CHECKS = 1');
        console.log('DATABASE CONNECTED! Tablas verificadas/creadas.');
    } catch (err) {
        console.error('Error ejecutando Db.sql:', err);
        throw err;
    } finally {
        connection.release();
    }
};

const IGNORABLE_MIGRATION_ERRORS = [
    'ER_DUP_FIELDNAME',
    'ER_CANT_DROP_FIELD_OR_KEY',
    'ER_BAD_FIELD_ERROR',
    'ER_CANT_CREATE_TABLE',
    'ER_DUP_FOREIGNKEY',
    'ER_FK_DUP_KEY',
    'ER_DUP_KEYNAME',
    'ER_NO_SUCH_TABLE',
    'ER_BAD_NULL_ERROR',
    'ER_DUP_ENTRY',
    'ER_TOO_LONG'
];

const MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN cedula VARCHAR(90) NULL UNIQUE",
    "ALTER TABLE users ADD COLUMN username VARCHAR(90) NULL UNIQUE",
    "ALTER TABLE users ADD COLUMN direccion TEXT NULL",
    "ALTER TABLE users ADD COLUMN reset_code VARCHAR(8) NULL",
    "ALTER TABLE users ADD COLUMN reset_code_expires DATETIME NULL",
    "ALTER TABLE users ADD COLUMN reset_code_attempts INT NOT NULL DEFAULT 0",
    "ALTER TABLE users MODIFY COLUMN reset_code VARCHAR(8) NULL",
    "ALTER TABLE mascotas ADD COLUMN doctor_nombre VARCHAR(255) NULL",
    "UPDATE mascotas m INNER JOIN doctors d ON m.doctor_id = d.id SET m.doctor_nombre = d.nombre",
    "ALTER TABLE mascotas DROP FOREIGN KEY mascotas_ibfk_2",
    "ALTER TABLE mascotas DROP COLUMN doctor_id",
    "ALTER TABLE citas ADD COLUMN fecha_cita DATE NULL",
    "ALTER TABLE notificaciones ADD COLUMN emisor_id BIGINT NULL",
    "ALTER TABLE notificaciones ADD CONSTRAINT fk_notificaciones_emisor FOREIGN KEY(emisor_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL",
    "CREATE INDEX idx_citas_user_created ON citas(user_id, created_at)",
    "CREATE INDEX idx_citas_estado_created ON citas(estado, created_at)",
    "CREATE INDEX idx_notif_user_created ON notificaciones(user_id, created_at)",
    "CREATE INDEX idx_notif_user_leida ON notificaciones(user_id, leida)",
    "CREATE INDEX idx_mascotas_especie ON mascotas(especie)",
    "CREATE INDEX idx_mascotas_doctor_nombre ON mascotas(doctor_nombre)",
    "CREATE INDEX idx_clients_fecha ON clients(fecha)",
    "CREATE FULLTEXT INDEX ft_clients_nombre ON clients(nombre_propietario)",
    "CREATE FULLTEXT INDEX ft_mascotas_nombre ON mascotas(nombre_mascota, raza)"
];

const runMigrations = async () => {
    const connection = await getConnectionAsync();
    try {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            try {
                await queryAsync(connection, MIGRATIONS[i]);
            } catch (err) {
                if (!IGNORABLE_MIGRATION_ERRORS.includes(err.code)) {
                    console.error(`Error en migración ${i + 1} (${err.code}):`, err.message);
                }
            }
        }
        console.log('Migraciones completadas.');
    } finally {
        connection.release();
    }
};

const ensureAdminUser = async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    try {
        const connection = await getConnectionAsync();
        try {
            const users = await queryAsync(connection,
                'SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]
            );
            if (users.length === 0) {
                const registrados = await queryAsync(connection,
                    'SELECT id, username, email, image FROM users'
                );
                console.warn(`ADMIN_EMAIL=${adminEmail}: usuario no encontrado. Registrados: ${JSON.stringify(registrados)}`);
                return;
            }
            await queryAsync(connection, `
                INSERT INTO user_has_roles(id_user, id_rol, created_at, updated_at)
                VALUES(?, 1, NOW(), NOW())
                ON DUPLICATE KEY UPDATE updated_at = NOW()
            `, [users[0].id]);
            const img = await queryAsync(connection,
                'SELECT image FROM users WHERE id = ?', [users[0].id]
            );
            console.log(`Rol ADMINISTRADOR verificado para ${adminEmail}. image=${JSON.stringify(img[0] && img[0].image)}`);
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error al asegurar rol ADMINISTRADOR (continuando):', err.message);
    }
};

module.exports = { pool, initializeDatabase, runMigrations, ensureAdminUser, getConnectionAsync, queryAsync };
