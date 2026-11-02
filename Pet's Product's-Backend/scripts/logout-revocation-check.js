#!/usr/bin/env node
/**
 * Verificación de la revocación de sesión (logout) del backend.
 *
 * Uso (con el servidor corriendo):
 *   node scripts/logout-revocation-check.js
 *
 * Opciones:
 *   --base <url>   Base de la API (por defecto PUBLIC_BASE_URL o http://localhost:3000)
 *
 * Emite JWT sintéticos con el mismo JWT_SECRET que usa el servidor y comprueba
 * que POST /api/users/logout invalida ese token en servidor (lista negra
 * token_revocations) sin afectar a otras sesiones abiertas, y que el flujo
 * restablecer contraseña invalida TODAS las sesiones del usuario
 * (user_session_revocations) sin romper el login posterior.
 *
 * La sección 5 crea un usuario de prueba temporal en la base de datos local y
 * lo elimina al terminar (en `finally`), por lo que no deja datos residuales.
 */
require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const argv = process.argv.slice(2);
const argValue = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const BASE = String(argValue('--base', process.env.PUBLIC_BASE_URL || 'http://localhost:3000')).replace(/\/+$/, '');
const PROTECTED = '/api/veterinary/doctors';

const results = [];

function report(name, ok, detail) {
    results.push({ name, ok });
    console.log(`${ok ? '  PASS' : '! FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function log(section) {
    console.log(`\n${section}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sign(tag, id = 999999) {
    if (!process.env.JWT_SECRET) {
        console.error('Falta JWT_SECRET en el entorno (.env).');
        process.exit(1);
    }
    return jwt.sign(
        { id, email: `${tag}@revocation.check`, roles: [3], jti: tag },
        process.env.JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
    );
}

async function call(path, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(`${BASE}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }
    return { status: response.status, payload };
}

// Node fetch no siempre permite fijar la cabecera Cookie, así que el canal de
// cookie se prueba con http.request, que sí la admite.
function callWithCookie(path, { method = 'GET', cookie } = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE}${path}`);
        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname + url.search,
                method,
                headers: cookie ? { Cookie: cookie } : {}
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    let payload = null;
                    try {
                        payload = JSON.parse(body);
                    } catch (_) {
                        payload = null;
                    }
                    resolve({ status: res.statusCode, payload });
                });
            }
        );
        req.on('error', reject);
        req.end();
    });
}

async function testBearerRevocation() {
    log('1. Revocación por cabecera Authorization (Bearer)');
    const token = sign(`check-${Date.now()}-a`);

    const before = await call(PROTECTED, { headers: { Authorization: `Bearer ${token}` } });
    report('Token válido antes del logout', before.status === 200, `HTTP ${before.status}`);

    const out = await call('/api/users/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
    });
    report('Logout con Bearer responde 200', out.status === 200, `HTTP ${out.status}`);

    const after = await call(PROTECTED, { headers: { Authorization: `Bearer ${token}` } });
    report(
        'El mismo token queda rechazado (401) tras el logout',
        after.status === 401,
        `HTTP ${after.status}${after.payload && after.payload.message ? ` — ${after.payload.message}` : ''}`
    );
}

async function testOtherSessionsSurvive() {
    log('2. Otras sesiones abiertas no se ven afectadas');
    const keep = sign(`check-${Date.now()}-b`);

    const first = await call(PROTECTED, { headers: { Authorization: `Bearer ${keep}` } });
    report('Segunda sesión activa', first.status === 200, `HTTP ${first.status}`);

    const out = await call('/api/users/logout', { method: 'POST' });
    report('Logout sin token responde 200', out.status === 200, `HTTP ${out.status}`);

    const after = await call(PROTECTED, { headers: { Authorization: `Bearer ${keep}` } });
    report('La segunda sesión sigue activa tras un logout ajeno', after.status === 200, `HTTP ${after.status}`);
}

async function testForgedToken() {
    log('3. Logout con token de firma falsa');
    const forged = jwt.sign({ id: 999999, email: 'forged@check', roles: [3] }, 'secreto-invalido', { expiresIn: '1h' });

    const out = await call('/api/users/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${forged}` }
    });
    report('No rompe el endpoint', out.status === 200, `HTTP ${out.status}`);

    const rows = await call(PROTECTED, { headers: { Authorization: `Bearer ${sign(`check-${Date.now()}-c`)}` } });
    report('Otras sesiones siguen activas', rows.status === 200, `HTTP ${rows.status}`);
}

async function testCookieChannel() {
    log('4. Revocación por cookie de sesión (canal clásico)');
    const token = sign(`check-${Date.now()}-d`);

    const before = await call(PROTECTED, { headers: { Authorization: `Bearer ${token}` } });
    report('Token válido antes del logout', before.status === 200, `HTTP ${before.status}`);

    const out = await callWithCookie('/api/users/logout', {
        method: 'POST',
        cookie: `session_token=${token}`
    });
    report('Logout con cookie responde 200', out.status === 200, `HTTP ${out.status}`);

    const after = await call(PROTECTED, { headers: { Authorization: `Bearer ${token}` } });
    report(
        'La copia Bearer del mismo token queda revocada',
        after.status === 401,
        `HTTP ${after.status}${after.payload && after.payload.message ? ` — ${after.payload.message}` : ''}`
    );
}

async function testPasswordResetRevokesAll() {
    log('5. Restablecer contraseña cierra TODAS las sesiones del usuario (e2e)');
    const suffix = Date.now().toString(36);
    const email = `revoc.test.${suffix}@example.com`;
    const username = `revoc_test_${suffix}`;
    const cedula = `T${suffix}`;
    const phone = `09${String(Date.now()).slice(-8)}`;
    const NEW_PASSWORD = 'Revocacion1';
    const RESET_CODE = '123456';

    const db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pets_products'
    });

    let userId = null;
    try {
        // Usuario de prueba con un código de restablecimiento válido, tal como
        // lo dejaría el flujo forgot-password (sin pasar por el envío de email).
        const [inserted] = await db.query(
            `INSERT INTO users
                (username, email, cedula, name, lastname, phone, password,
                 reset_code, reset_code_expires, reset_code_attempts, created_at, updated_at)
             VALUES (?, ?, ?, 'Revocacion', 'Prueba', ?, 'hash-inicial-no-usado', ?, ?, 0, NOW(), NOW())`,
            [username, email, cedula, phone, RESET_CODE, new Date(Date.now() + 10 * 60 * 1000)]
        );
        userId = inserted.insertId;

        // El login usa INNER JOIN con user_has_roles: sin rol, findByUsernameOrEmail
        // no devuelve la fila y el login respondería 401. Se asigna CLIENTE (3),
        // el rol que usaría el registro normal (y se borra en cascada al final).
        await db.query(
            'INSERT INTO user_has_roles (id_user, id_rol, created_at, updated_at) VALUES (?, 3, NOW(), NOW())',
            [userId]
        );

        const oldToken = sign(`reset-${suffix}`, userId);
        const before = await call(PROTECTED, { headers: { Authorization: `Bearer ${oldToken}` } });
        report('La sesión abierta del usuario está activa antes del reset', before.status === 200, `HTTP ${before.status}`);

        const reset = await call('/api/users/reset-password', {
            method: 'POST',
            body: { email, code: RESET_CODE, password: NEW_PASSWORD }
        });
        report('El endpoint de restablecer contraseña acepta (200)', reset.status === 200, `HTTP ${reset.status}`);

        const after = await call(PROTECTED, { headers: { Authorization: `Bearer ${oldToken}` } });
        report(
            'La sesión anterior queda revocada (401)',
            after.status === 401,
            `HTTP ${after.status}${after.payload && after.payload.message ? ` — ${after.payload.message}` : ''}`
        );

        // Espera a que el segundo de emisión (iat) sea posterior al corte para
        // comprobar que el nuevo login NO queda bloqueado.
        await sleep(1200);
        const login = await call('/api/users/login', {
            method: 'POST',
            body: { username_or_email: email, password: NEW_PASSWORD }
        });
        report('Login con la contraseña nueva (200)', login.status === 200, `HTTP ${login.status}`);

        const newToken = login.payload && login.payload.data && login.payload.data.session_token;
        if (newToken) {
            const fresh = await call(PROTECTED, { headers: { Authorization: `Bearer ${newToken}` } });
            report('La nueva sesión tras el reset funciona (200)', fresh.status === 200, `HTTP ${fresh.status}`);
        } else {
            report('La nueva sesión tras el reset funciona (200)', false, 'no se recibió session_token');
        }
    } finally {
        try {
            if (userId) {
                // La fila de corte se elimina en cascada con el usuario.
                await db.query('DELETE FROM users WHERE id = ?', [userId]);
            }
        } catch (_) { /* best-effort */ }
        await db.end().catch(() => {});
    }
}

async function main() {
    console.log(`API: ${BASE}`);

    try {
        await testBearerRevocation();
        await testOtherSessionsSurvive();
        await testForgedToken();
        await testCookieChannel();
    } catch (error) {
        if (error && (error.code === 'ECONNREFUSED' || error.cause || error.name === 'TypeError')) {
            console.error(`\nNo se pudo conectar con la API en ${BASE}. ¿Está el servidor arrancado?`);
        } else {
            console.error('\nError durante la verificación:', error);
        }
        process.exitCode = 1;
    }

    try {
        await testPasswordResetRevokesAll();
    } catch (error) {
        if (error && (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.errno)) {
            console.error(`\nSección 5: no se pudo completar contra la API/MySQL (${error.code || error.message}).`);
        } else {
            console.error('\nSección 5 — error durante la verificación:', error);
        }
        process.exitCode = 1;
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\nResultado: ${results.length - failed.length}/${results.length} comprobaciones OK`);
    if (failed.length > 0) {
        failed.forEach((r) => console.log(`  - ${r.name}`));
        process.exitCode = 1;
    }
}

main();
