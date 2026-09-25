import { initNotificationModal, loadNotificationCount, getNotificationIconHtml, bindAvatarFallback, formatDate } from './NotificationModal.js';
import { isCitaDetailNotification, openCitaDetailById } from './CitaDetailModal.js';
import { requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr } from './security.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const notificationBadge = document.getElementById('notification-badge');
    const btnNotifications = document.getElementById('btn-notifications');

    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    const refreshBtn = document.getElementById('refresh-btn');

    const notificationsList = document.getElementById('notifications-list');
    const notificationsCounter = document.getElementById('notifications-counter');

    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const btnConfirmNo = document.getElementById('btnConfirmNo');
    const btnConfirmYes = document.getElementById('btnConfirmYes');

    let pendingDeleteId = null;

    if (btnConfirmNo) {
        btnConfirmNo.addEventListener('click', () => {
            pendingDeleteId = null;
            deleteConfirmModal.classList.remove('active');
        });
    }

    if (btnConfirmYes) {
        btnConfirmYes.addEventListener('click', () => {
            if (pendingDeleteId === null) return;

            btnConfirmYes.disabled = true;
            btnConfirmYes.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btnConfirmNo.disabled = true;

            executeDeleteNotification(pendingDeleteId);
            pendingDeleteId = null;
        });
    }

    let currentPage = 1;
    let totalPages = 1;

    initNotificationModal(userData, { bindBellButton: false });
    loadNotificationCount(notificationBadge);
    loadNotifications(true);

    markAllReadBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de marcar todas las notificaciones como leídas?')) {
            return;
        }

        try {
            const response = await apiFetch(`/notificaciones/user/${userData.id}/read-all`, {
                method: 'PUT'
            });

            const result = await response.json();

            if (result.success) {
                alert('Todas las notificaciones han sido marcadas como leídas.');
                loadNotificationCount(notificationBadge);
                loadNotifications(true);
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error al marcar todas como leídas:', error);
            alert('Error de red. Asegúrate de que el backend esté encendido.');
        }
    });

    refreshBtn.addEventListener('click', () => {
        loadNotificationCount(notificationBadge);
        loadNotifications(true);
    });

    btnNotifications.addEventListener('click', () => {
        loadNotificationCount(notificationBadge);
        loadNotifications(true);
    });

    async function loadNotifications(resetPage = true) {
        if (resetPage) currentPage = 1;
        try {
            notificationsList.innerHTML = '<div class="loading-notifications"><div class="spinner"></div> Cargando notificaciones...</div>';

            const response = await apiFetch(apiUrl(`/notificaciones/user/${userData.id}`, {
                page: currentPage,
                limit: 20
            }));
            const result = await response.json();

            if (result.success) {
                const notifications = result.data;
                totalPages = (result.pagination && result.pagination.totalPages) || 1;
                displayNotifications(notifications, result.pagination);
            } else {
                notificationsList.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>Error al cargar notificaciones</p></div>';
            }
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
            notificationsList.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>Error de conexión</p></div>';
        }
    }

    function renderPaginationControls() {
        let controls = document.getElementById('notif-pagination-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'notif-pagination-controls';
            controls.style.cssText = 'display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-top:1rem;';
            notificationsList.parentElement.appendChild(controls);
        }
        controls.innerHTML = `
            <button class="btn-pagination-prev" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
            <span>Página ${currentPage} de ${totalPages}</span>
            <button class="btn-pagination-next" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente <i class="fas fa-chevron-right"></i></button>
        `;
        controls.querySelector('.btn-pagination-prev').addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; loadNotifications(false); }
        });
        controls.querySelector('.btn-pagination-next').addEventListener('click', () => {
            if (currentPage < totalPages) { currentPage++; loadNotifications(false); }
        });
    }

    function displayNotifications(notifications, pagination) {
        if (pagination) {
            notificationsCounter.textContent = `${pagination.total} notificación(es) — Página ${pagination.page}/${pagination.totalPages}`;
        } else {
            notificationsCounter.textContent = `${notifications.length} notificación(es)`;
        }

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<div class="no-notifications"><i class="fas fa-bell-slash"></i><p>No tienes notificaciones</p></div>';
            renderPaginationControls();
            return;
        }

        notificationsList.innerHTML = '';

        notifications.forEach(notif => {
            const notifItem = document.createElement('div');
            notifItem.className = `notification-item ${notif.leida === 0 ? 'unread' : ''}`;
            notifItem.innerHTML = `
                <div class="notification-icon">
                    ${getNotificationIconHtml(notif)}
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${escapeHtml(notif.titulo)}
                        <span class="notification-type-badge ${escapeAttr(getTypeBadgeClass(notif.tipo))}">${escapeHtml(notif.tipo)}</span>
                    </div>
                    <div class="notification-message">${escapeHtml(notif.mensaje)}</div>
                    <div class="notification-time">${escapeHtml(formatDate(notif.created_at))}</div>
                </div>
                <button class="notification-delete-btn" title="Eliminar notificación" data-id="${escapeAttr(notif.id)}">
                    <i class="fas fa-trash"></i>
                </button>
            `;

            bindAvatarFallback(notifItem);

            notifItem.querySelector('.notification-content').addEventListener('click', () => {
                markAsRead(notif.id);
                if (isCitaDetailNotification(notif)) {
                    const notificationModal = document.getElementById('notification-modal');
                    if (notificationModal) notificationModal.classList.remove('active');
                    openCitaDetailById(notif.cita_id);
                }
            });
            notifItem.querySelector('.notification-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNotification(notif.id);
            });

            notificationsList.appendChild(notifItem);
        });

        renderPaginationControls();
    }

    async function markAsRead(notifId) {
        try {
            await apiFetch(`/notificaciones/${notifId}/read`, {
                method: 'PUT'
            });
            loadNotificationCount(notificationBadge);
            loadNotifications(true);
        } catch (error) {
            console.error('Error al marcar notificación como leída:', error);
        }
    }

    async function deleteNotification(notifId) {
        pendingDeleteId = notifId;
        deleteConfirmModal.classList.add('active');
    }

    async function executeDeleteNotification(notifId) {
        try {
            const response = await apiFetch(`/notificaciones/${notifId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                deleteConfirmModal.classList.remove('active');
                loadNotificationCount(notificationBadge);
                loadNotifications(true);
            } else {
                deleteConfirmModal.classList.remove('active');
                alert(`Error al eliminar: ${result.message}`);
            }
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            deleteConfirmModal.classList.remove('active');
            alert('Error de red. Asegúrate de que el backend esté encendido.');
        } finally {
            btnConfirmYes.disabled = false;
            btnConfirmYes.textContent = 'Sí';
            btnConfirmNo.disabled = false;
        }
    }

    function getTypeBadgeClass(tipo) {
        switch (tipo) {
            case 'CITA':
                return 'type-cita';
            default:
                return '';
        }
    }
});
