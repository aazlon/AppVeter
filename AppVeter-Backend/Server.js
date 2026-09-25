const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET no está definido en el entorno (.env)');
    process.exit(1);
}

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);

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
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.REGISTER_RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiados intentos de registro. Intenta de nuevo más tarde.' }
});

app.use('/api', apiLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/forgot-password', authLimiter);
app.use('/api/users/verify-reset-code', authLimiter);
app.use('/api/users/reset-password', authLimiter);
app.use('/api/users/register', registerLimiter);
app.use('/api/users/register_with_image', registerLimiter);
app.use('/api/users/register-receptionist', registerLimiter);
app.use('/api/users/register-veterinarian', registerLimiter);

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

        app.listen(port, () => {
            console.log(`Servidor corriendo en http://localhost:${port}`);
        });
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
