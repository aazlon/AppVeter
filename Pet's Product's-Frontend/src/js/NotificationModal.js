import { isCitaDetailNotification, openCitaDetailById } from './CitaDetailModal.js';
import { apiFetch, API_BASE } from './api.js';
import { escapeHtml, escapeAttr, safeUrl } from './security.js';

let userData = null;
let onCountChange = null;
let eventSource = null;

const SSE_BASE_DELAY = 5000;
const SSE_MAX_DELAY = 60000;
const SSE_MAX_ATTEMPTS = 5;
const SSE_SLOW_DELAY = 5 * 60 * 1000;
const COUNT_RELOAD_INTERVAL = 1500;

let reconnectAttempts = 0;
let reconnectTimer = null;
let sseStopped = false;
let countReloadTimer = null;
let pendingCountElement = null;
let lastCountReload = 0;
let reopenTimer = null;
const readsInFlight = new Set();
let sessionListenerBound = false;

export function initNotificationModal(user, options = {}) {
    userData = user;
    if (options.onCountChange) onCountChange = options.onCountChange;

    if (!document.getElementById('notification-modal')) {
        const modalHTML = `
            <div class="modal" id="notification-modal">
                <div class="modal-content notification-modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-bell"></i> Notificaciones</h2>
                        <button class="close-modal-btn" id="close-notification-modal">&times;</button>
                    </div>
                    <div class="modal-body" id="notification-modal-body">
                        <div class="loading-notifications">
                            <div class="spinner"></div> Cargando notificaciones...
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn btn-secondary" id="view-all-notifications">Ver más</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setupListeners();
    }

    if (options.bindBellButton !== false) {
        const bellBtn = document.getElementById('btn-notifications');
        if (bellBtn) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNotificationModal();
            });
        }
    }

    if (!sessionListenerBound) {
        sessionListenerBound = true;
        window.addEventListener('app:session-cleared', disconnectSSE);
    }

    connectSSE();
}

export function disconnectSSE() {
    sseStopped = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    clearTimeout(countReloadTimer);
    countReloadTimer = null;
    closeEventSource();
}

function closeEventSource() {
    if (!eventSource) return;
    eventSource.close();
    eventSource = null;
}

function connectSSE() {
    if (eventSource || reconnectTimer || sseStopped || !userData) return;
    if (typeof EventSource === 'undefined') return;

    try {
        eventSource = new EventSource(`${API_BASE}/notificaciones/stream`, { withCredentials: true });

        eventSource.onopen = () => {
            reconnectAttempts = 0;
            hideSseNotice();
        };

        eventSource.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (payload && payload.type && payload.type !== 'connected') {
                    scheduleCountReload();
                }
            } catch (_) { /* ignore malformed payload */ }
        };

        eventSource.onerror = () => {
            closeEventSource();
            scheduleReconnect();
        };
    } catch (_) {
        closeEventSource();
        scheduleReconnect();
    }
}

function scheduleReconnect(extraDelay = 0) {
    if (sseStopped || reconnectTimer || !userData) return;

    reconnectAttempts += 1;

    let delay = SSE_SLOW_DELAY;
    if (reconnectAttempts <= SSE_MAX_ATTEMPTS) {
        delay = Math.min(SSE_BASE_DELAY * (2 ** (reconnectAttempts - 1)), SSE_MAX_DELAY);
    } else {
        showSseNotice('Sin conexión con el servidor de notificaciones. Reintentando cada 5 minutos...');
    }

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;

        const probe = await probeStream();
        if (sseStopped) return;

        if (probe.status === 401 || probe.status === 403) {
            sseStopped = true;
            return;
        }

        if (probe.status === 429) {
            scheduleReconnect(Math.max(probe.retryAfter * 1000, SSE_SLOW_DELAY));
            return;
        }

        connectSSE();
    }, Math.max(delay, extraDelay));
}

async function probeStream() {
    const controller = new AbortController();
    try {
        const response = await fetch(`${API_BASE}/notificaciones/stream`, {
            credentials: 'include',
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal
        });
        const status = response.status;
        const retryAfter = Number(response.headers.get('Retry-After')) || 0;
        controller.abort();
        return { status, retryAfter };
    } catch (_) {
        return { status: 0, retryAfter: 0 };
    }
}

function showSseNotice(message) {
    if (document.getElementById('sse-notice')) return;
    const notice = document.createElement('div');
    notice.id = 'sse-notice';
    notice.textContent = message;
    notice.style.cssText = [
        'position:fixed',
        'left:50%',
        'transform:translateX(-50%)',
        'bottom:1.2rem',
        'padding:0.6rem 1rem',
        'border-radius:10px',
        'background:#1f2937',
        'color:#ffffff',
        'font-size:0.85rem',
        'z-index:9999',
        'box-shadow:0 10px 25px rgba(0,0,0,0.2)'
    ].join(';');
    document.body.appendChild(notice);
}

function hideSseNotice() {
    const notice = document.getElementById('sse-notice');
    if (notice) notice.remove();
}

function flushCountReload() {
    countReloadTimer = null;
    const badge = pendingCountElement || document.getElementById('notification-badge');
    pendingCountElement = null;
    lastCountReload = Date.now();
    if (badge) loadNotificationCount(badge);
}

function scheduleCountReload() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    pendingCountElement = badge;

    const elapsed = Date.now() - lastCountReload;
    if (elapsed >= COUNT_RELOAD_INTERVAL && !countReloadTimer) {
        flushCountReload();
        return;
    }
    if (countReloadTimer) return;

    countReloadTimer = setTimeout(flushCountReload, Math.max(COUNT_RELOAD_INTERVAL - elapsed, 0));
}

function setupListeners() {
    const modal = document.getElementById('notification-modal');
    const closeBtn = document.getElementById('close-notification-modal');
    const viewAllBtn = document.getElementById('view-all-notifications');

    if (closeBtn) closeBtn.addEventListener('click', closeNotificationModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeNotificationModal();
            }
        });
    }

    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => {
            window.location.href = './AllNotifications.html';
        });
    }
}

export async function loadNotificationCount(badgeElement) {
    if (!userData) return;
    try {
        const response = await apiFetch(`/notificaciones/user/${userData.id}/unread-count`);
        const result = await response.json();

        if (result.success && result.data.count > 0) {
            badgeElement.textContent = result.data.count > 9 ? '+9' : result.data.count;
            badgeElement.classList.remove('hidden');
            badgeElement.classList.add('show');
        } else {
            badgeElement.classList.remove('show');
            badgeElement.classList.add('hidden');
        }

        if (onCountChange) onCountChange(result.data.count || 0);
    } catch (error) {
        console.error('Error al cargar contador de notificaciones:', error);
    }
}

export async function openNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (!modal) return;

    modal.classList.add('active');
    const modalBody = document.getElementById('notification-modal-body');
    modalBody.innerHTML = '<div class="loading-notifications"><div class="spinner"></div> Cargando notificaciones...</div>';

    try {
        const response = await apiFetch(`/notificaciones/user/${userData.id}?page=1&limit=3`);
        const result = await response.json();

        if (result.success) {
            const notifications = result.data;
            displayNotifications(notifications, modalBody);
        } else {
            modalBody.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>Error al cargar notificaciones</p></div>';
        }
    } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        modalBody.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>Error de conexión</p></div>';
    }
}

export function closeNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) modal.classList.remove('active');
}

function displayNotifications(notifications, container) {
    if (notifications.length === 0) {
        container.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones</p></div>';
        return;
    }

    container.innerHTML = '';

    notifications.forEach(notif => {
        const notifItem = document.createElement('div');
        notifItem.className = `notification-item ${notif.leida === 0 ? 'unread' : ''}`;
        notifItem.innerHTML = `
            <div class="notification-icon">
                ${getNotificationIconHtml(notif)}
            </div>
            <div class="notification-content">
                <div class="notification-title">${escapeHtml(notif.titulo)}</div>
                <div class="notification-message">${escapeHtml(notif.mensaje)}</div>
                <div class="notification-time">${escapeHtml(formatDate(notif.created_at))}</div>
            </div>
        `;

        bindAvatarFallback(notifItem);

        notifItem.addEventListener('click', () => {
            if (isCitaDetailNotification(notif)) {
                closeNotificationModal();
                markAsRead(notif.id, false);
                openCitaDetailById(notif.cita_id);
            } else {
                markAsRead(notif.id);
            }
        });
        container.appendChild(notifItem);
    });
}

export async function markAsRead(notifId, reopenModal = true) {
    if (readsInFlight.has(notifId)) return;
    readsInFlight.add(notifId);

    try {
        await apiFetch(`/notificaciones/${notifId}/read`, {
            method: 'PUT'
        });
        scheduleCountReload();
        if (reopenModal) scheduleReopenModal();
    } catch (error) {
        console.error('Error al marcar notificación como leída:', error);
    } finally {
        readsInFlight.delete(notifId);
    }
}

function scheduleReopenModal() {
    if (reopenTimer) return;
    reopenTimer = setTimeout(() => {
        reopenTimer = null;
        openNotificationModal();
    }, 400);
}

export function getNotificationIcon(tipo) {
    switch (tipo) {
        case 'CITA':
            return 'fa-calendar-check';
        default:
            return 'fa-bell';
    }
}

const PHOTO_NOTIFICATION_TITLES = [
    'nueva solicitud de cita',
    'cita aprobada',
    'cita rechazada'
];

export function getNotificationIconHtml(notif) {
    const titulo = (notif.titulo || '').trim().toLowerCase();
    const hasEmisor = notif.emisor_image || notif.emisor_nombre;
    if (hasEmisor && PHOTO_NOTIFICATION_TITLES.includes(titulo)) {
        const src = escapeAttr(safeUrl(notif.emisor_image, '../assets/cliente.jpg'));
        return `<img src="${src}" alt="Perfil" class="notification-avatar">`;
    }
    const icon = escapeAttr(getNotificationIcon(notif.tipo));
    return `<i class="fas ${icon}"></i>`;
}

export function bindAvatarFallback(item) {
    const avatar = item.querySelector('.notification-avatar');
    if (avatar) {
        avatar.addEventListener('error', () => {
            const icon = document.createElement('i');
            icon.className = 'fas fa-calendar-check';
            avatar.replaceWith(icon);
        });
    }
}

export function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES');
}
