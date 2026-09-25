import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr } from './security.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const notificationBadge = document.getElementById('notification-badge');
    const tbody = document.getElementById('receptionists-tbody');
    const recordsCount = document.getElementById('records-count');

    const { isAdmin } = getRoleFlags(userData);

    if (!isAdmin) {
        window.location.href = './UserScreen.html';
        return;
    }

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);

    async function loadReceptionists() {
        try {
            const response = await apiFetch(apiUrl('/users/receptionists', { page: 1, limit: 50 }));
            const result = await response.json();

            if (response.ok && result.success) {
                const users = result.data;
                const total = (result.pagination && result.pagination.total) || users.length;
                recordsCount.textContent = `${total} registro${total !== 1 ? 's' : ''}`;

                if (users.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="loading-td">No hay recepcionistas registrados.</td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = users.map(user => `
                    <tr>
                        <td>${escapeHtml(user.name) || '-'}</td>
                        <td>${escapeHtml(user.lastname) || '-'}</td>
                        <td>${escapeHtml(user.username) || '-'}</td>
                        <td>${escapeHtml(user.email) || '-'}</td>
                        <td>${escapeHtml(user.phone) || '-'}</td>
                        <td class="actions-col">
                            <div class="actions-wrapper">
                                <button class="action-btn btn-delete" data-id="${escapeAttr(user.id)}" data-name="${escapeAttr(user.name || '')} ${escapeAttr(user.lastname || '')}" title="Eliminar recepcionista">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');

                document.querySelectorAll('.btn-delete').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.id;
                        const name = btn.dataset.name;
                        const confirmed = confirm(`¿Estás seguro de eliminar al recepcionista "${name}"? Esta acción no se puede deshacer.`);

                        if (!confirmed) return;

                        try {
                            const delResponse = await apiFetch(`/users/${id}`, {
                                method: 'DELETE'
                            });

                            const delResult = await delResponse.json();

                            if (delResponse.ok && delResult.success) {
                                alert('Recepcionista eliminado correctamente.');
                                loadReceptionists();
                            } else {
                                alert(delResult.message || 'Error al eliminar el recepcionista.');
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('Error de conexión con el servidor.');
                        }
                    });
                });
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="loading-td">Error al cargar los recepcionistas.</td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-td">Error de conexión con el servidor.</td>
                </tr>
            `;
        }
    }

    loadReceptionists();
});