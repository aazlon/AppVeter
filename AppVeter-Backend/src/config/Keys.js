module.exports = {
    secretOrKey: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: process.env.SESSION_COOKIE_NAME || 'session_token'
};
