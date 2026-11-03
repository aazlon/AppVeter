// Validaciones de entrada compartidas por los controladores.
// Objetivo (PRUEBAS_FUNCIONALES.md 6.2, lección 4): detectar entradas inválidas
// ANTES de tocar la base de datos y responder 400/404 controlados en lugar de 500.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value, maxLength = Infinity) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isValidEmail(value) {
    return typeof value === 'string' && value.length <= 180 && EMAIL_REGEX.test(value.trim());
}

function isValidId(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
}

// Valida un texto con formato 'YYYY-MM-DD' que además exista en el calendario
// (evita cosas como '2026-02-31', que MySQL aceptaría o corrompería).
function parseDateOnly(value) {
    if (typeof value !== 'string' || !DATE_ONLY_REGEX.test(value.trim())) return null;
    const [year, month, day] = value.trim().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return { year, month, day };
}

function isValidDateOnly(value) {
    return parseDateOnly(value) !== null;
}

// 'YYYY-MM-DD' igual o posterior a hoy (fecha local del servidor).
function isTodayOrFutureDate(value) {
    const parsed = parseDateOnly(value);
    if (!parsed) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(parsed.year, parsed.month - 1, parsed.day);
    return target.getTime() >= today.getTime();
}

module.exports = {
    isNonEmptyString,
    isValidEmail,
    isValidId,
    parseDateOnly,
    isValidDateOnly,
    isTodayOrFutureDate
};
