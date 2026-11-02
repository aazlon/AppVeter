const jwt = require('jsonwebtoken');
const Keys = require('../config/Keys');
const { isTokenRevoked } = require('../utils/tokenRevocation');
const logger = require('../utils/logger');

const ROLE_IDS = {
    ADMINISTRADOR: 1,
    RECEPCIONISTA: 2,
    CLIENTE: 3,
    VETERINARIO: 4
};

function extractTokens(req) {
    const tokens = [];
    if (req.cookies && typeof req.cookies[Keys.cookieName] === 'string' && req.cookies[Keys.cookieName]) {
        tokens.push(req.cookies[Keys.cookieName].replace(/^(Bearer|JWT)\s+/i, ''));
    }
    const header = req.headers.authorization || '';
    const parts = header.split(' ');
    if (parts.length === 2 && /^(Bearer|JWT)$/i.test(parts[0])) {
        if (parts[1]) tokens.push(parts[1]);
    } else if (parts.length === 1 && parts[0]) {
        tokens.push(parts[0]);
    }
    return tokens;
}

function extractToken(req) {
    return extractTokens(req)[0] || null;
}

function verifyToken(token) {
    if (!Keys.secretOrKey) {
        throw new Error('JWT_SECRET no está definido en el entorno');
    }
    return jwt.verify(token, Keys.secretOrKey, { algorithms: ['HS256'] });
}

async function authenticate(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
    }
    let payload;
    try {
        payload = verifyToken(token);
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    }
    try {
        if (await isTokenRevoked(token, payload)) {
            return res.status(401).json({ success: false, message: 'La sesión fue cerrada. Inicia sesión de nuevo.' });
        }
    } catch (err) {
        // Sin acceso a la lista de revocaciones no es posible garantizar la
        // sesión: se rechaza la petición (fail-closed) y se deja constancia.
        logger.error({ err }, 'Error al consultar la revocación del token');
        return res.status(500).json({ success: false, message: 'Error verificando la sesión' });
    }
    req.user = payload;
    next();
}

async function optionalAuth(req, res, next) {
    req.user = null;
    const token = extractToken(req);
    if (token) {
        try {
            req.user = verifyToken(token);
            if (await isTokenRevoked(token, req.user)) {
                req.user = null;
            }
        } catch (err) {
            req.user = null;
        }
    }
    next();
}

function userRoleIds(user) {
    if (!user) return [];
    if (Array.isArray(user.roles)) {
        return user.roles.map((r) => Number(r)).filter((n) => Number.isFinite(n));
    }
    return [];
}

function hasRole(req, ...roles) {
    const ids = userRoleIds(req.user).map(String);
    return roles.some((role) => {
        const id = typeof role === 'number' ? role : ROLE_IDS[role];
        return id !== undefined && ids.includes(String(id));
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
        }
        if (!hasRole(req, ...roles)) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para esta operación' });
        }
        next();
    };
}

function isOwnerOrStaff(req, userId) {
    if (!req.user) return false;
    if (hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA')) return true;
    return String(req.user.id) === String(userId);
}

module.exports = {
    ROLE_IDS,
    authenticate,
    optionalAuth,
    requireRole,
    hasRole,
    isOwnerOrStaff,
    extractToken,
    extractTokens
};
