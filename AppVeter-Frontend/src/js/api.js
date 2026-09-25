export const API_BASE = (
    (typeof window !== 'undefined' && window.__APPVETER_API__) ||
    'http://localhost:3000/api'
);

const MAX_CONCURRENT_REQUESTS = 6;
const DEFAULT_RETRY_AFTER = 60;

let activeRequests = 0;
const pendingQueue = [];
let rateLimitUntil = 0;
let logoutInProgress = false;

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
        return null;
    }
}

export function getToken() {
    try {
        const stored = sessionStorage.getItem('session_token');
        if (stored) return String(stored).replace(/^(JWT|Bearer)\s+/i, '');
    } catch (_) { /* ignore */ }
    const user = getSession();
    if (!user || !user.session_token) return null;
    return String(user.session_token).replace(/^(JWT|Bearer)\s+/i, '');
}

export function buildHeaders(options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const isFormData = options.body instanceof FormData;
    if (options.body && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    return headers;
}

function acquireSlot() {
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        activeRequests += 1;
        return Promise.resolve();
    }
    return new Promise((resolve) => pendingQueue.push(resolve));
}

function releaseSlot() {
    activeRequests -= 1;
    const next = pendingQueue.shift();
    if (next) {
        activeRequests += 1;
        next();
    }
}

function buildRateLimitedResponse(retryAfterSeconds) {
    const seconds = Math.max(1, retryAfterSeconds || DEFAULT_RETRY_AFTER);
    return new Response(
        JSON.stringify({
            success: false,
            message: `Demasiadas solicitudes al servidor. Espera ${seconds} segundo(s) y vuelve a intentarlo.`,
            retryAfterSeconds: seconds
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(seconds)
            }
        }
    );
}

async function readRetryAfter(res) {
    const header = Number(res.headers.get('Retry-After'));
    if (Number.isFinite(header) && header > 0) return header;

    try {
        const body = await res.clone().json();
        const fromBody = Number(body && body.retryAfterSeconds);
        if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
    } catch (_) { /* ignore */ }

    return DEFAULT_RETRY_AFTER;
}

function handleRateLimited(retryAfterSeconds) {
    rateLimitUntil = Date.now() + retryAfterSeconds * 1000;
    showToastRateLimited(retryAfterSeconds);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app:rate-limited', {
            detail: { retryAfterSeconds }
        }));
    }
}

function showToastRateLimited(retryAfterSeconds) {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('api-429-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'api-429-notice';
    toast.textContent = `Demasiadas solicitudes. Reintentar en ${retryAfterSeconds}s`;
    toast.style.cssText = [
        'position:fixed',
        'left:50%',
        'transform:translateX(-50%)',
        'top:1rem',
        'padding:0.6rem 1rem',
        'border-radius:10px',
        'background:#ef4444',
        'color:#ffffff',
        'font-size:0.9rem',
        'font-weight:600',
        'z-index:10000',
        'box-shadow:0 10px 25px rgba(0,0,0,0.2)'
    ].join(';');
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function handleExpiredSession(res) {
    if (res.status !== 401) return;
    if (!getSession()) return;
    if (typeof window !== 'undefined' && window.location.pathname.includes('Login')) return;
    if (logoutInProgress) return;

    logoutInProgress = true;
    window.dispatchEvent(new Event('app:session-cleared'));

    try {
        await fetch(`${API_BASE}/users/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) { /* ignore */ }

    localStorage.removeItem('user');
    try { sessionStorage.removeItem('session_token'); } catch (_) { /* ignore */ }
    window.location.href = './Login.html';
}

export async function apiFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

    if (rateLimitUntil > Date.now()) {
        const remaining = Math.ceil((rateLimitUntil - Date.now()) / 1000);
        return buildRateLimitedResponse(remaining);
    }

    await acquireSlot();

    try {
        if (rateLimitUntil > Date.now()) {
            const remaining = Math.ceil((rateLimitUntil - Date.now()) / 1000);
            return buildRateLimitedResponse(remaining);
        }

        const res = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: buildHeaders(options)
        });

        if (res.status === 429) {
            const retryAfterSeconds = await readRetryAfter(res);
            handleRateLimited(retryAfterSeconds);
            return res;
        }

        if (res.status === 401) {
            handleExpiredSession(res, path);
        }

        return res;
    } finally {
        releaseSlot();
    }
}

export async function logoutRequest() {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('app:session-cleared'));
    }
    try {
        await fetch(`${API_BASE}/users/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) { /* ignore */ }
    localStorage.removeItem('user');
    try { sessionStorage.removeItem('session_token'); } catch (_) { /* ignore */ }
}

export function apiUrl(base, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, value);
        }
    });
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
}
