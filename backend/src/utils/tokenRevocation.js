const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Keys = require('../config/Keys');
const { queryAsync } = require('../config/Config');
const logger = require('./logger');

// Control de revocación de JWT en dos niveles:
//
// 1. token_revocations (lista negra por token): cada logout almacena el hash
//    SHA-256 del token junto a su fecha de expiración. Sirve para invalidar una
//    sesión concreta sin tocar las demás sesiones del mismo usuario.
//
// 2. user_session_revocations (corte por usuario): al restablecer la contraseña
//    se guarda el instante (epoch) a partir del cual ningún JWT emitido antes de
//    ese momento se acepta. Los tokens del nuevo login (iat posterior) siguen
//    funcionando.
//
// authenticate() consulta ambos en una sola sentencia antes de aceptar la
// petición; un token capturado deja de servir en cuanto se cierra la sesión o
// se cambia la contraseña.

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Solo acepta tokens firmados por nosotros. La expiración se ignora aquí porque
// un token ya caducado no necesita revocarse, pero su payload sigue válido.
function decodeSignedToken(token) {
    if (!Keys.secretOrKey || !token) return null;
    try {
        return jwt.verify(token, Keys.secretOrKey, {
            algorithms: ['HS256'],
            ignoreExpiration: true
        });
    } catch (_) {
        return null;
    }
}

async function revokeToken(token) {
    const payload = decodeSignedToken(token);
    if (!payload || !payload.exp) return false;

    const expiresAt = new Date(payload.exp * 1000);
    await queryAsync(
        null,
        'INSERT IGNORE INTO token_revocations (token_hash, expires_at, created_at) VALUES (?, ?, NOW())',
        [hashToken(token), expiresAt]
    );

    // Limpieza oportunista de filas ya caducadas (el token no puede usarse
    // después de expirar, así que esas entradas dejan de ser necesarias).
    queryAsync(null, 'DELETE FROM token_revocations WHERE expires_at <= NOW()')
        .catch((err) => logger.error({ err }, 'Error limpiando token_revocations'));

    return true;
}

// Invalida todas las sesiones abiertas de un usuario: cualquier JWT con
// iat <= corte deja de aceptarse. Se usa al restablecer la contraseña.
async function revokeAllForUser(userId) {
    if (userId === undefined || userId === null || userId === '') return false;

    const cutoff = Math.floor(Date.now() / 1000);
    await queryAsync(
        null,
        `INSERT INTO user_session_revocations (user_id, revoked_at_epoch, created_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            revoked_at_epoch = GREATEST(revoked_at_epoch, VALUES(revoked_at_epoch)),
            created_at = VALUES(created_at)`,
        [userId, cutoff]
    );
    return true;
}

// Devuelve true si el token está en la lista negra o si su emisión (iat) es
// anterior o igual al corte del usuario. `payload` es el resultado de verificar
// la firma; si no se pasa, se decodifica aquí.
async function isTokenRevoked(token, payload = null) {
    const p = payload || decodeSignedToken(token);
    if (!p) return false;

    const rows = await queryAsync(
        null,
        `SELECT
            EXISTS(
                SELECT 1 FROM token_revocations
                WHERE token_hash = ? AND expires_at > NOW()
            ) AS token_revoked,
            (
                SELECT revoked_at_epoch FROM user_session_revocations
                WHERE user_id = ?
            ) AS user_cutoff`,
        [hashToken(token), p.id !== undefined && p.id !== null ? p.id : null]
    );

    const row = rows[0];
    if (!row) return false;
    if (Number(row.token_revoked) === 1) return true;

    const cutoff = row.user_cutoff !== null && row.user_cutoff !== undefined ? Number(row.user_cutoff) : null;
    const iat = p.iat !== undefined && p.iat !== null ? Number(p.iat) : null;
    if (cutoff !== null && iat !== null && Number.isFinite(iat) && iat <= cutoff) return true;

    return false;
}

module.exports = { revokeToken, revokeAllForUser, isTokenRevoked, hashToken };
