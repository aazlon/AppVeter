export const API_BASE = (
    (typeof window !== 'undefined' && window.__APPVETER_API__) ||
    'http://localhost:3000/api'
);

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

export async function apiFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: buildHeaders(options)
    });

    if (res.status === 401 && getSession() && !window.location.pathname.includes('Login')) {
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

    return res;
}

export async function logoutRequest() {
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
