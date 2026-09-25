#!/usr/bin/env node
/**
 * Verificación de los límites de tasa del backend.
 *
 * Uso (con el servidor corriendo y MySQL accesible):
 *   node scripts/rate-limit-check.js
 *
 * Opciones:
 *   --base <url>   Base de la API (por defecto PUBLIC_BASE_URL o http://localhost:3000)
 *   --no-reset     No borra los contadores antes/después (los resultados
 *                  pueden mezclarse con actividad previa)
 *   --keep         Borra al empezar pero deja los contadores al terminar
 *                  (útil para inspeccionar la tabla rate_limits)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const argValue = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const BASE = String(argValue('--base', process.env.PUBLIC_BASE_URL || 'http://localhost:3000')).replace(/\/+$/, '');
const NO_RESET = hasFlag('--no-reset');
const KEEP = hasFlag('--keep');

const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;
const LOGIN_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10;
const WRITE_MAX = Number(process.env.WRITE_RATE_LIMIT_MAX) || 120;

const results = [];

function report(name, ok, detail) {
    results.push({ name, ok });
    console.log(`${ok ? '  PASS' : '! FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function log(section) {
    console.log(`\n${section}`);
}

async function connectDb() {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'appveter'
    });
}

async function resetCounters(db) {
    await db.query('DELETE FROM rate_limits');
    await db.query('DELETE FROM sse_counters');
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(`${BASE}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', ...headers }
    });

    let payload = null;
    if (response.status === 429) {
        try {
            payload = await response.json();
        } catch (_) {
            payload = null;
        }
    }

    return {
        status: response.status,
        retryAfter: response.headers.get('retry-after'),
        payload
    };
}

async function mapLimit(items, limit, worker) {
    const queue = items.slice();
    const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
        while (queue.length > 0) {
            await worker(queue.shift());
        }
    });
    await Promise.all(runners);
}

function summarize(responses) {
    const blocked = responses.filter((r) => r.status === 429);
    return {
        blocked: blocked.length,
        total: responses.length,
        first: blocked[0] || null
    };
}

async function testHealth() {
    log('1. GET /api/health debe quedar fuera del límite global');
    const responses = [];
    await mapLimit(Array.from({ length: 120 }, (_, i) => i), 20, async (i) => {
        responses.push(await call(`/api/health?i=${i}`));
    });
    const errors = responses.filter((r) => r.status !== 200).length;
    report('El health check no recibe 429', errors === 0, `${responses.length - errors}/${responses.length} con 200`);
}

async function testAuthByIp() {
    log('2. Límite de autenticación por IP (authLimiter)');
    const responses = [];
    for (let i = 0; i < AUTH_MAX + 5; i++) {
        responses.push(await call('/api/users/login', {
            method: 'POST',
            body: { username_or_email: `no-existe-${i}`, password: 'x' }
        }));
    }
    const { blocked, first } = summarize(responses);
    report('Bloquea tras agotar la cuota por IP', blocked >= 5, `${blocked}/${responses.length} respuestas 429 (cuota ${AUTH_MAX})`);

    if (first) {
        const seconds = Number(first.retryAfter);
        report('El 429 incluye cabecera Retry-After', Number.isFinite(seconds) && seconds > 0, `Retry-After=${first.retryAfter}`);
        const bodySeconds = Number(first.payload && first.payload.retryAfterSeconds);
        report('El 429 incluye retryAfterSeconds en el cuerpo', Number.isFinite(bodySeconds) && bodySeconds > 0, `retryAfterSeconds=${bodySeconds && first.payload.retryAfterSeconds}`);
    } else {
        report('El 429 incluye cabecera Retry-After', false, 'no se recibió ningún 429');
        report('El 429 incluye retryAfterSeconds en el cuerpo', false, 'no se recibió ningún 429');
    }
}

async function testBuckets(db) {
    log('3. Los contadores viven en MySQL (compartidos entre workers)');
    const [rows] = await db.query('SELECT bucket, hits FROM rate_limits ORDER BY bucket');
    report('Hay contadores persistidos en rate_limits', rows.length > 0, `${rows.length} bucket(s): ${rows.map((r) => r.bucket).join(', ')}`);

    const prefixes = new Set(rows.map((r) => r.bucket.replace(/_.*/, '_')));
    report('Límite por cuenta de login activo', prefixes.has('login_'), 'bucket login_* presente');
    report('Límite de escritura activo', prefixes.has('write_'), 'bucket write_* presente');
}

async function testXffSpoof() {
    log('4. X-Forwarded-For no debe evadir los límites (trust proxy)');
    const responses = [];
    for (let i = 0; i < AUTH_MAX + 5; i++) {
        responses.push(await call('/api/users/login', {
            method: 'POST',
            body: { username_or_email: `xfp-${i}`, password: 'x' },
            headers: { 'X-Forwarded-For': `203.0.113.${(i % 200) + 1}` }
        }));
    }
    const { blocked } = summarize(responses);
    report('Rotar X-Forwarded-For no reinicia la cuota', blocked >= 5, `${blocked}/${responses.length} respuestas 429`);
}

async function testLoginByAccount() {
    log('5. Límite de login por cuenta (loginAccountLimiter)');
    const responses = [];
    for (let i = 0; i < LOGIN_MAX + 5; i++) {
        responses.push(await call('/api/users/login', {
            method: 'POST',
            body: { username_or_email: 'mismo-usuario', password: 'x' }
        }));
    }
    const { blocked } = summarize(responses);
    report('Bloquea al agotar la cuota de la misma cuenta', blocked >= 5, `${blocked}/${responses.length} respuestas 429 (cuota ${LOGIN_MAX})`);
}

async function testWrite() {
    log('6. Límite de operaciones de escritura (writeLimiter)');
    const responses = [];
    await mapLimit(Array.from({ length: WRITE_MAX + 5 }, (_, i) => i), 20, async (i) => {
        responses.push(await call('/api/citas/create', { method: 'POST', body: { i } }));
    });
    const { blocked } = summarize(responses);
    report(`Bloquea tras ${WRITE_MAX} escrituras`, blocked >= 5, `${blocked}/${responses.length} respuestas 429`);
}

async function main() {
    console.log(`API: ${BASE}`);
    console.log('Nota: la prueba consume la cuota local; al terminar se limpian los contadores (salvo --keep).');

    let db;
    try {
        db = await connectDb();
    } catch (error) {
        console.error(`\nNo se pudo conectar a MySQL (${error.code || error.message}). Arranca la base de datos o revisa el .env.`);
        process.exit(1);
    }

    try {
        if (!NO_RESET) await resetCounters(db);

        await testHealth();

        if (!NO_RESET) await resetCounters(db);
        await testAuthByIp();
        await testBuckets(db);

        if (!NO_RESET) await resetCounters(db);
        await testXffSpoof();

        if (!NO_RESET) await resetCounters(db);
        await testLoginByAccount();

        if (!NO_RESET) await resetCounters(db);
        await testWrite();

        if (!NO_RESET && !KEEP) {
            await resetCounters(db);
            console.log('\nContadores limpiados.');
        } else if (KEEP) {
            console.log('\nContadores conservados (--keep).');
        }
    } catch (error) {
        if (error && (error.code === 'ECONNREFUSED' || error.cause || error.name === 'TypeError')) {
            console.error(`\nNo se pudo conectar con la API en ${BASE}. ¿Está el servidor arrancado?`);
        } else {
            console.error('\nError durante la verificación:', error);
        }
        process.exitCode = 1;
    } finally {
        await db.end().catch(() => {});
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\nResultado: ${results.length - failed.length}/${results.length} comprobaciones OK`);
    if (failed.length > 0) {
        failed.forEach((r) => console.log(`  - ${r.name}`));
        process.exitCode = 1;
    }
}

main();
