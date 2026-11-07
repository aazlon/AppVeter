const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Keys = require('../config/Keys');
const { queryAsync } = require('../config/Config');
const logger = require('./logger');



function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}


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


    queryAsync(null, 'DELETE FROM token_revocations WHERE expires_at <= NOW()')
        .catch((err) => logger.error({ err }, 'Error limpiando token_revocations'));

    return true;
}


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
