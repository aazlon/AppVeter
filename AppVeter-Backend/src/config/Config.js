const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'appveter',
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 50,
    waitForConnections: true,
    queueLimit: 200,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
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
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));
};

const runScript = async (connection, script) => {
    const statements = splitStatements(script);
    for (const statement of statements) {
        await queryAsync(connection, statement);
    }
};

const initializeDatabase = async () => {
    const connection = await getConnectionAsync();
    try {
        const sqlScript = fs.readFileSync(path.join(__dirname, '../db/Db.sql')).toString();
        await runScript(connection, sqlScript);
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

module.exports = { pool, initializeDatabase, runMigrations, getConnectionAsync, queryAsync };
