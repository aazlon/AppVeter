

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
