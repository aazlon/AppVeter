export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
    return escapeHtml(value);
}

export function safeUrl(value, fallback = '') {
    if (!value) return fallback;
    const str = String(value).trim();
    if (/^(https?:|data:image\/|\/|\.\.\/)/i.test(str)) {
        if (/^\s*javascript:/i.test(str)) return fallback;
        return str;
    }
    return fallback;
}
