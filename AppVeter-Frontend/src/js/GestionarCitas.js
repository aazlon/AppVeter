import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import {
    openCitaDetailModal,
    openConfirmModal,
    getStatusClass,
    getStatusText,
    formatDateTable
} from './CitaDetailModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr } from './security.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const { isRecepcionista } = getRoleFlags(userData);

    if (!isRecepcionista) {
        alert('Acceso exclusivo para recepcionistas. Redirigiendo...');
        window.location.href = './UserScreen.html';
        return;
    }

    const notificationBadge = document.getElementById('notification-badge');
    const filterEstado = document.getElementById('filter-estado');
    const refreshBtn = document.getElementById('refresh-btn');

    const citasTbody = document.getElementById('citas-tbody');
    const citasCounter = document.getElementById('citas-counter');

    const editDateModal = document.getElementById('edit-date-modal');
    const closeEditDateModal = document.getElementById('close-edit-date-modal');
    const cancelEditDateBtn = document.getElementById('cancel-edit-date-btn');
    const saveEditDateBtn = document.getElementById('save-edit-date-btn');
    const editDatePropietario = document.getElementById('edit-date-propietario');
    const editDateEstado = document.getElementById('edit-date-estado');
    const editDateInput = document.getElementById('edit-date-input');

    let pendingCitaId = null;
    let currentPage = 1;
    let totalPages = 1;

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);
    loadCitas(true);

    filterEstado.addEventListener('change', () => {
        loadCitas(true);
    });

    refreshBtn.addEventListener('click', () => {
        loadCitas(true);
        loadNotificationCount(notificationBadge);
    });

    document.addEventListener('citas:updated', () => {
        loadCitas();
    });

    closeEditDateModal.addEventListener('click', closeEditDateModalFn);
    cancelEditDateBtn.addEventListener('click', closeEditDateModalFn);
    editDateModal.addEventListener('click', (e) => {
        if (e.target === editDateModal) {
            closeEditDateModalFn();
        }
    });

    saveEditDateBtn.addEventListener('click', () => {
        const fecha = editDateInput.value;
        if (!fecha) {
            alert('Debe seleccionar una fecha para la cita.');
            return;
        }
        saveEditDateBtn.disabled = true;
        saveEditDateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        updateCitaDate(pendingCitaId, fecha);
    });

    function closeEditDateModalFn() {
        editDateModal.classList.remove('active');
        pendingCitaId = null;
        saveEditDateBtn.disabled = false;
        saveEditDateBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Fecha';
    }

    async function loadCitas(resetPage = true) {
        if (resetPage) currentPage = 1;
        const estado = filterEstado.value;

        try {
            citasTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading-td">
                        <div class="spinner"></div> Cargando citas...
                    </td>
                </tr>
            `;

            const response = await apiFetch(apiUrl('/citas/all', {
                estado,
                page: currentPage,
                limit: 20
            }));
            const result = await response.json();

            if (result.success) {
                const citas = result.data;
                totalPages = (result.pagination && result.pagination.totalPages) || 1;
                renderCitasTable(citas, result.pagination);
            } else {
                citasTbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="loading-td text-danger">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar datos: ${escapeHtml(result.message)}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error al conectar con la API de citas:', error);
            citasTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading-td">
                        <i class="fas fa-plug"></i> No se pudo conectar con el servidor backend
                    </td>
                </tr>
            `;
        }
    }

    function renderCitasTable(citas, pagination) {
        citasTbody.innerHTML = '';
        if (pagination) {
            citasCounter.textContent = `${pagination.total} cita(s) — Página ${pagination.page}/${pagination.totalPages}`;
        } else {
            citasCounter.textContent = `${citas.length} cita(s)`;
        }

        if (citas.length === 0) {
            citasTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading-td">
                        <i class="fas fa-info-circle"></i> No se encontraron citas con los filtros aplicados.
                    </td>
                </tr>
            `;
            renderPaginationControls();
            return;
        }

        citas.forEach(cita => {
            const tr = document.createElement('tr');

            const statusClass = getStatusClass(cita.estado);
            const statusText = getStatusText(cita.estado);
            const canApproveReject = cita.estado === 'PENDIENTE';
            const fechaCitaDisplay = cita.fecha_cita
                ? new Date(cita.fecha_cita).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                : '---';

            tr.innerHTML = `
                <td><strong>${escapeHtml(formatDateTable(cita.fecha_solicitud))}</strong></td>
                <td>${escapeHtml(cita.nombre_propietario)}</td>
                <td>${escapeHtml(cita.ci)}</td>
                <td>${escapeHtml(cita.telefono)}</td>
                <td style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(cita.motivo_cita)}">
                    ${escapeHtml(cita.motivo_cita)}
                </td>
                <td>${escapeHtml(fechaCitaDisplay)}</td>
                <td><span class="status-badge ${escapeAttr(statusClass)}">${escapeHtml(statusText)}</span></td>
                <td class="actions-col">
                    <div class="actions-wrapper">
                        <button class="action-btn btn-view" title="Ver Detalle" data-id="${escapeAttr(cita.id)}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-approve" title="Aprobar" data-id="${escapeAttr(cita.id)}" ${!canApproveReject ? 'disabled' : ''}>
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn btn-reject" title="Rechazar" data-id="${escapeAttr(cita.id)}" ${!canApproveReject ? 'disabled' : ''}>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-view').addEventListener('click', () => openCitaDetailModal(cita));
            tr.querySelector('.btn-approve').addEventListener('click', () => openConfirmModal('APROBADA', cita));
            tr.querySelector('.btn-reject').addEventListener('click', () => openConfirmModal('RECHAZADA', cita));

            citasTbody.appendChild(tr);
        });

        renderPaginationControls();
    }

    function renderPaginationControls() {
        let controls = document.getElementById('citas-pagination-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'citas-pagination-controls';
            controls.style.cssText = 'display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-top:1rem;';
            citasCounter.parentElement.appendChild(controls);
        }
        controls.innerHTML = `
            <button class="btn-pagination-prev" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
            <span>Página ${currentPage} de ${totalPages}</span>
            <button class="btn-pagination-next" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente <i class="fas fa-chevron-right"></i></button>
        `;
        controls.querySelector('.btn-pagination-prev').addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; loadCitas(false); }
        });
        controls.querySelector('.btn-pagination-next').addEventListener('click', () => {
            if (currentPage < totalPages) { currentPage++; loadCitas(false); }
        });
    }

    function openEditDateModal(cita) {
        pendingCitaId = cita.id;
        editDatePropietario.textContent = cita.nombre_propietario;
        editDateEstado.textContent = cita.estado;
        editDateInput.value = cita.fecha_cita ? cita.fecha_cita.split('T')[0] : '';
        editDateInput.min = new Date().toISOString().split('T')[0];
        editDateModal.classList.add('active');
    }

    async function updateCitaDate(citaId, fecha_cita) {
        try {
            const response = await apiFetch(`/citas/${citaId}/date`, {
                method: 'PUT',
                body: JSON.stringify({ fecha_cita })
            });

            const result = await response.json();

            if (result.success) {
                closeEditDateModalFn();
                alert('Fecha de la cita actualizada exitosamente.');
                loadCitas(true);
            } else {
                alert(`Error al actualizar la fecha: ${result.message}`);
                saveEditDateBtn.disabled = false;
                saveEditDateBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Fecha';
            }
        } catch (error) {
            console.error('Error al actualizar fecha:', error);
            alert('Error de red. Asegúrate de que el backend esté encendido.');
            saveEditDateBtn.disabled = false;
            saveEditDateBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Fecha';
        }
    }
});
