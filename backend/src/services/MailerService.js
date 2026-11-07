const nodemailer = require('nodemailer');

// En Render Free los puertos SMTP salientes (25/465/587) están bloqueados, así que
// el envío en producción va por HTTPS (puerto 443):
//   1) API de Gmail con OAuth2  (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)
//   2) API de Brevo             (BREVO_API_KEY)
//   3) SMTP directo de Gmail     (EMAIL_USER / EMAIL_PASS) — funciona en desarrollo
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const hasGmailApiConfig = () => Boolean(
    process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN
);

// Remitente: EMAIL_FROM manda; si no está, se usa la cuenta autenticada (EMAIL_USER).
const senderAddress = () => process.env.EMAIL_FROM || process.env.EMAIL_USER;

const transporter = (process.env.EMAIL_USER && process.env.EMAIL_PASS) ? nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
}) : null;

// Diagnóstico al arrancar: deja claro qué proveedor está activo y avisa si falta configurar.
if (process.env.NODE_ENV === 'production') {
    if (hasGmailApiConfig()) {
        console.log('[Mailer] Envio por API de Gmail (OAuth2, sin SMTP)');
    } else if (process.env.BREVO_API_KEY) {
        console.log('[Mailer] Envio por API HTTPS de Brevo (BREVO_API_KEY configurada)');
    } else if (transporter) {
        transporter.verify()
            .then(() => console.log('[Mailer] SMTP listo para enviar correos'))
            .catch((err) => console.error('[Mailer] Fallo SMTP al arrancar:', err.code || '-', err.response || err.message));
    } else {
        console.error('[Mailer] Sin GMAIL_*, sin BREVO_API_KEY y sin EMAIL_USER/EMAIL_PASS: no se podrá enviar correo');
    }
}

// Cache del access token: Google lo emite por 1 hora; se renueva 60 s antes de expirar.
let gmailAccessToken = { value: null, expiresAt: 0 };
let gmailTokenRequest = null;

const getGmailAccessToken = async () => {
    if (gmailAccessToken.value && Date.now() < gmailAccessToken.expiresAt) {
        return gmailAccessToken.value;
    }
    // Si dos correos salen a la vez con el token vencido, se comparte una sola petición.
    if (gmailTokenRequest) {
        return gmailTokenRequest;
    }

    gmailTokenRequest = (async () => {
        const res = await fetch(GMAIL_TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GMAIL_CLIENT_ID,
                client_secret: process.env.GMAIL_CLIENT_SECRET,
                refresh_token: process.env.GMAIL_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            }).toString()
        });

        let data = {};
        try { data = await res.json(); } catch (_) { /* respuesta sin JSON */ }

        if (!res.ok) {
            const code = data.error || `HTTP ${res.status}`;
            const hint = code === 'invalid_grant'
                ? ' (refresh token vencido o revocado: con la app en estado "Prueba" Google lo invalida cada 7 días, hay que regenerarlo en el OAuth Playground)'
                : '';
            throw new Error(`Google OAuth ${code}${hint}: ${data.error_description || res.statusText}`);
        }

        const ttlMs = Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000;
        gmailAccessToken = { value: data.access_token, expiresAt: Date.now() + ttlMs };
        return gmailAccessToken.value;
    })();

    try {
        return await gmailTokenRequest;
    } finally {
        gmailTokenRequest = null;
    }
};

// El asunto lleva acentos, así que va codificado según RFC 2047 para no salir corrupto.
const encodeSubject = (subject) => `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

const wrapBase64 = (value) => value.replace(/(.{76})/g, '$1\r\n');

// La API de Gmail exige el mensaje MIME completo en base64url.
const buildMime = (mail) => {
    const recipient = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to;
    const body = wrapBase64(Buffer.from(mail.html, 'utf8').toString('base64'));

    return [
        `From: "Pet's Product's" <${senderAddress()}>`,
        `To: ${recipient}`,
        `Subject: ${encodeSubject(mail.subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        body
    ].join('\r\n');
};

// Envío por la API de Gmail (HTTPS 443, compatible con Render Free).
// Requiere el scope https://www.googleapis.com/auth/gmail.send autorizado por la
// cuenta de EMAIL_FROM; el refresh token se obtiene en el OAuth Playground.
const sendViaGmailApi = async (mail) => {
    if (!senderAddress()) {
        throw new Error('Falta EMAIL_FROM (o EMAIL_USER) como remitente de Gmail');
    }

    const accessToken = await getGmailAccessToken();
    const raw = Buffer.from(buildMime(mail), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const res = await fetch(GMAIL_SEND_URL, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify({ raw })
    });

    if (!res.ok) {
        // Un 401 suele ser token inválido en cache: se descarta para pedir otro en el próximo intento.
        if (res.status === 401) {
            gmailAccessToken = { value: null, expiresAt: 0 };
        }
        let detail = '';
        try { detail = (await res.text()).slice(0, 500); } catch (_) { /* sin cuerpo */ }
        throw new Error(`Gmail API ${res.status}: ${detail || res.statusText}`);
    }
};

// Envío por la API HTTPS de Brevo (compatible con Render Free, puerto 443).
// Requiere en el dashboard de Brevo: remitente verificado y una API key con
// permiso "Send transactional emails".
const sendViaBrevo = async (mail) => {
    const recipient = Array.isArray(mail.to) ? mail.to[0] : mail.to;
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: 'Pet\'s Product\'s', email: senderAddress() },
            to: [{ email: recipient }],
            subject: mail.subject,
            htmlContent: mail.html
        })
    });

    if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 500); } catch (_) { /* sin cuerpo */ }
        throw new Error(`Brevo API ${res.status}: ${detail || res.statusText}`);
    }
};

const buildResetMail = (email, code) => ({
    from: `"Pet's Product's" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Código de recuperación de contraseña',
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2c5a94;">Recuperación de Contraseña</h2>
                </div>
                <p style="font-size: 16px; color: #333;">Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p style="font-size: 16px; color: #333;">Tu código de verificación es:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2c5a94; background: #e8f1f8; padding: 15px 30px; border-radius: 8px; display: inline-block;">${code}</span>
                </div>
                <p style="font-size: 14px; color: #888;">Este código expirará en 5 minutos.</p>
                <p style="font-size: 14px; color: #888;">Si no solicitaste este cambio, ignora este mensaje.</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">Pet's Product's - Pets Products 2022 C.A</p>
            </div>
        `
});

const sendResetCode = async (email, code) => {
    const mailOptions = buildResetMail(email, code);

    if (hasGmailApiConfig()) {
        await sendViaGmailApi(mailOptions);
        return;
    }
    if (process.env.BREVO_API_KEY) {
        await sendViaBrevo(mailOptions);
        return;
    }
    if (!transporter) {
        throw new Error('No hay transport: falta GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN, BREVO_API_KEY o EMAIL_USER/EMAIL_PASS');
    }
    await transporter.sendMail(mailOptions);
};

module.exports = { sendResetCode };
