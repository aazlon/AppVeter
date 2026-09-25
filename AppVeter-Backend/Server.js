const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const expressRateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { rateLimit } = expressRateLimit;
const ipKeyGenerator = typeof expressRateLimit.ipKeyGenerator === 'function'
    ? expressRateLimit.ipKeyGenerator
    : (ip) => ip;

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET no está definido en el entorno (.env)');
    process.exit(1);
}

const app = express();
const port = Number(process.env.PORT) || 3000;

// Sin proxy delante, confiar únicamente en la IP del socket.
// Si algún día hay nginx/CDN delante, sube TRUST_PROXY_HOPS en .env al número
// exacto de proxies. Un valor mayor que el real permite falsear X-Forwarded-For
// y saltarse todos los límites por IP.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
const trustProxy = Number.isInteger(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : false;
app.set('trust proxy', trustProxy);

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080,http://localhost:5500')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const allowAllOrigins = corsOrigins.includes('*');
const isProduction = process.env.NODE_ENV === 'production';

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (allowAllOrigins) return true;
    if (corsOrigins.includes(origin)) return true;
    if (!isProduction) {
        if (origin === 'null') return true;
        try {
            const host = new URL(origin).hostname;
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
                return true;
            }
        } catch (_) { /* invalid origin */ }
    }
    return false;
}

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"]
        }
    }
}));
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, origin || false);
        } else {
            callback(new Error(`Origen no permitido por CORS: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [
        'Retry-After',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'RateLimit-Policy'
    ]
}));
app.use(compression());

const logger = require('./src/utils/logger');
const MysqlRateStore = require('./src/store/MysqlRateStore');

// Con trust proxy desactivado Express ignora X-Forwarded-For, por lo que la
// advertencia de express-rate-limit sobre esa cabecera no aplica.
const rateLimitValidation = trustProxy ? true : { default: true, xForwardedForHeader: false };

const isSseStream = (req) => req.path === '/notificaciones/stream';
const isReadOnly = (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';

function rateLimitHandler(req, res, next, options) {
    const retryAfter = Number(res.getHeader('Retry-After'));
    logger.warn({
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
        retryAfter
    }, 'Solicitud bloqueada por rate limit');

    res.status(429).json({
        success: false,
        message: options.message?.message || 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
        ...(Number.isFinite(retryAfter) ? { retryAfterSeconds: retryAfter } : {})
    });
}

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'api_' }),
    validate: rateLimitValidation,
    skip: (req) => isSseStream(req) || req.path === '/health',
    message: { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

const sseLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: Number(process.env.SSE_RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'sse_' }),
    validate: rateLimitValidation,
    message: { success: false, message: 'Demasiadas reconexiones en tiempo real. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.WRITE_RATE_LIMIT_MAX) || 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'write_' }),
    validate: rateLimitValidation,
    skip: (req) => isReadOnly(req),
    message: { success: false, message: 'Demasiadas operaciones de escritura. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'auth_' }),
    validate: rateLimitValidation,
    message: { success: false, message: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
    handler: rateLimitHandler
});

// Segundo límite sobre el mismo endpoint: mientras authLimiter cubre la IP,
// éste cubre la cuenta, para que rotar correos desde una misma IP no esquive
// la fuerza bruda de contraseñas.
const loginAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'login_' }),
    validate: rateLimitValidation,
    keyGenerator: (req) => {
        const body = req.body || {};
        const identifier = String(body.username_or_email || body.email || '').trim().toLowerCase();
        const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
        if (!identifier) return `login_ip_${ipKeyGenerator(ip)}`;
        return `login_user_${identifier}`;
    },
    message: { success: false, message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.REGISTER_RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'reg_' }),
    validate: rateLimitValidation,
    message: { success: false, message: 'Demasiados intentos de registro. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.UPLOAD_RATE_LIMIT_MAX) || 25,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MysqlRateStore({ prefix: 'up_' }),
    validate: rateLimitValidation,
    message: { success: false, message: 'Demasiadas subidas o modificaciones con imagen. Intenta de nuevo más tarde.' },
    handler: rateLimitHandler
});

// Límites que no necesitan el body van ANTES de express.json(): así un
// atacante no consume CPU parseando payloads que igual se van a rechazar.
app.use('/api', apiLimiter);
app.use('/api/notificaciones/stream', sseLimiter);
app.use('/api', writeLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Límites que sí necesitan leer el body (email de login / registro).
app.use('/api/users/login', authLimiter);
app.use('/api/users/login', loginAccountLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/verify-reset-code', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/register', registerLimiter);
app.use('/api/users/register_with_image', registerLimiter);
app.use('/api/users/register-receptionist', registerLimiter);
app.use('/api/users/register-veterinarian', registerLimiter);

// Rutas que admiten imágenes (hasta 5MB por petición).
const uploadPaths = [
    '/api/users/register_with_image',
    '/api/users/register-receptionist',
    '/api/users/register-veterinarian',
    '/api/novedades/with-image',
    '/api/novedades/:id/with-image',
    '/api/services/with-image',
    '/api/services/:id/with-image',
    '/api/veterinary/register'
];
uploadPaths.forEach((route) => app.use(route, uploadLimiter));
// PUT /api/users/:id también admite imagen.
app.use('/api/users', (req, res, next) => (req.method === 'PUT' ? uploadLimiter(req, res, next) : next()));

app.use('/uploads', apiLimiter);
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));

app.get('/', (req, res) => {
    res.send('¡Proyecto Node.js iniciado con éxito!');
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, status: 'ok', uptime: process.uptime() });
});

const usersRoutes = require('./src/routes/UserRoutes');
const veterinaryRoutes = require('./src/routes/VeterinaryRoutes');
const citaRoutes = require('./src/routes/CitaRoutes');
const notificacionRoutes = require('./src/routes/NotificacionRoutes');
const serviceRoutes = require('./src/routes/ServiceRoutes');
const novedadRoutes = require('./src/routes/NovedadRoutes');

usersRoutes(app);
veterinaryRoutes(app);
citaRoutes(app);
notificacionRoutes(app);
serviceRoutes(app);
novedadRoutes(app);

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'La imagen supera el tamaño máximo permitido (5MB).' });
    }
    if (err && err.status === 400) {
        return res.status(400).json({ success: false, message: err.message || 'Archivo no válido' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Payload demasiado grande' });
    }
    console.error('Error no manejado:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

const { initializeDatabase, runMigrations } = require('./src/config/Config');

async function startServer() {
    try {
        await initializeDatabase();
        await runMigrations();
        console.log('Base de datos inicializada.');

        const server = app.listen(port, () => {
            console.log(`Servidor corriendo en http://localhost:${port}`);
        });

        // Corta conexiones que entreguen la petición incompleta (slowloris).
        // No afecta a las respuestas largas como el stream SSE.
        server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 15000;
        server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;
        server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 5000;
        server.maxHeadersCount = 100;
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();

process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
});

module.exports = { app };
