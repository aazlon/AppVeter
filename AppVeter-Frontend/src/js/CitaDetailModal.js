import { showSuccessModal } from './SuccessModal.js';
import { getSession } from './Roles.js';
import { apiFetch } from './api.js';
import { escapeHtml, escapeAttr } from './security.js';

let currentCita = null;
let pendingAction = null;
let pendingCitaId = null;
let detailBound = false;
let confirmBound = false;

export function getCurrentCita() {
    return currentCita;
}

export function isCitaDetailNotification(notif) {
    if (!notif || !notif.cita_id || !notif.titulo) return false;
    return notif.titulo.trim().toLowerCase() === 'nueva solicitud de cita';
}

export async function openCitaDetailById(citaId) {
    try {
        const response = await apiFetch(`/citas/${citaId}`);
        const result = await response.json();

        if (result.success) {
            openCitaDetailModal(result.data);
        } else {
            alert(`No se pudo cargar la cita: ${result.message}`);
        }
    } catch (error) {
        console.error('Error al cargar la cita:', error);
        alert('Error de red. Asegúrate de que el backend esté encendido.');
    }
}

export function openCitaDetailModal(cita) {
    currentCita = cita;

    const modal = ensureDetailModal();
    const detailModalBody = document.getElementById('detail-modal-body');
    const detailApproveBtn = document.getElementById('detail-approve-btn');
    const detailRejectBtn = document.getElementById('detail-reject-btn');
    const canApproveReject = cita.estado === 'PENDIENTE';

    if (detailApproveBtn) detailApproveBtn.disabled = !canApproveReject;
    if (detailRejectBtn) detailRejectBtn.disabled = !canApproveReject;

    const fechaCitaDisplay = cita.fecha_cita
        ? new Date(cita.fecha_cita).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'No asignada';

    detailModalBody.innerHTML = `
        <div class="detail-section">
            <h4><i class="fas fa-user"></i> Información del Propietario</h4>
            <div class="detail-item"><strong>Nombre:</strong> <span>${escapeHtml(cita.nombre_propietario)}</span></div>
            <div class="detail-item"><strong>Cédula:</strong> <span>${escapeHtml(cita.ci)}</span></div>
            <div class="detail-item"><strong>Teléfono:</strong> <span>${escapeHtml(cita.telefono)}</span></div>
            <div class="detail-item"><strong>Correo:</strong> <span>${escapeHtml(cita.correo_electronico)}</span></div>
            <div class="detail-item"><strong>Dirección:</strong> <span>${escapeHtml(cita.direccion)}</span></div>
        </div>
        <div class="detail-section">
            <h4><i class="fas fa-calendar"></i> Información de la Cita</h4>
            <div class="detail-item"><strong>Fecha Solicitud:</strong> <span>${escapeHtml(formatDateTable(cita.fecha_solicitud))}</span></div>
            <div class="detail-item"><strong>Fecha Cita:</strong> <span>${escapeHtml(fechaCitaDisplay)}</span></div>
            <div class="detail-item"><strong>Estado:</strong> <span class="status-badge ${escapeAttr(getStatusClass(cita.estado))}">${escapeHtml(getStatusText(cita.estado))}</span></div>
            <div class="detail-item"><strong>Motivo:</strong> <span>${escapeHtml(cita.motivo_cita)}</span></div>
        </div>
    `;
    modal.classList.add('active');
}

export function openConfirmModal(accion, cita) {
    pendingAction = accion;
    pendingCitaId = cita.id;

    const confirmModal = ensureConfirmModal();
    const isApprove = accion === 'APROBADA';

    const confirmModalHeader = document.getElementById('confirm-modal-header');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmIcon = document.getElementById('confirm-icon');
    const confirmActionLabel = document.getElementById('confirm-action-label');
    const confirmPropietario = document.getElementById('confirm-propietario');
    const confirmDateSection = document.getElementById('confirm-date-section');
    const confirmFechaCita = document.getElementById('confirm-fecha-cita');
    const confirmInfoText = document.getElementById('confirm-info-text');

    confirmModalHeader.style.backgroundColor = isApprove ? '#d4edda' : '#f8d7da';
    confirmModalTitle.innerHTML = isApprove
        ? '<i class="fas fa-check-circle"></i> Confirmar Aprobación'
        : '<i class="fas fa-times-circle"></i> Confirmar Rechazo';
    confirmModalTitle.style.color = isApprove ? '#155724' : '#721c24';

    confirmIcon.innerHTML = isApprove
        ? '<i class="fas fa-check-circle" style="font-size: 48px; color: #28a745;"></i>'
        : '<i class="fas fa-times-circle" style="font-size: 48px; color: #dc3545;"></i>';
    confirmActionLabel.textContent = accion;
    confirmActionLabel.style.color = isApprove ? '#28a745' : '#dc3545';
    confirmPropietario.textContent = cita.nombre_propietario;

    confirmDateSection.style.display = isApprove ? 'block' : 'none';
    confirmFechaCita.required = isApprove;
    confirmFechaCita.value = '';
    confirmFechaCita.min = new Date().toISOString().split('T')[0];

    confirmInfoText.textContent = isApprove
        ? 'Al aprobar esta cita, se asignará la fecha seleccionada y se notificará al cliente.'
        : 'Al rechazar esta cita, se notificará al cliente sobre la decisión.';

    confirmModal.classList.add('active');
}

function ensureStylesheet() {
    if (document.querySelector('link[href*="CitaDetailModal.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../css/CitaDetailModal.css';
    document.head.appendChild(link);
}

function ensureSuccessModal() {
    if (document.getElementById('successModal')) return;

    if (!document.querySelector('link[href*="SuccessModal.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '../css/SuccessModal.css';
        document.head.appendChild(link);
    }

    document.body.insertAdjacentHTML('beforeend', `
        <div class="success-modal" id="successModal">
            <div class="success-modal-content">
                <div class="success-icon-wrapper">
                    <i class="fas fa-check"></i>
                </div>
                <p class="success-modal-message" id="successModalMessage">La cita se ha actualizado correctamente</p>
            </div>
        </div>
    `);
}

function ensureDetailModal() {
    let modal = document.getElementById('detail-modal');

    if (!modal) {
        ensureStylesheet();
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="detail-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-info-circle"></i> Detalle de la Cita</h2>
                        <button class="close-modal-btn" id="close-detail-modal">&times;</button>
                    </div>
                    <div class="modal-body" id="detail-modal-body"></div>
                    <div class="modal-footer">
                        <button class="modal-btn btn-approve detail-action-btn" id="detail-approve-btn">
                            <i class="fas fa-check"></i> Aprobar
                        </button>
                        <button class="modal-btn btn-reject detail-action-btn" id="detail-reject-btn">
                            <i class="fas fa-times"></i> Rechazar
                        </button>
                        <button class="modal-btn btn-secondary" id="modal-close-action">Cerrar</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('detail-modal');
    }

    if (!detailBound) {
        bindDetailEvents(modal);
        detailBound = true;
    }

    return modal;
}

function bindDetailEvents(modal) {
    const closeBtn = document.getElementById('close-detail-modal');
    const footerCloseBtn = document.getElementById('modal-close-action');
    const approveBtn = document.getElementById('detail-approve-btn');
    const rejectBtn = document.getElementById('detail-reject-btn');

    const closeModal = () => modal.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (footerCloseBtn) footerCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (approveBtn) approveBtn.addEventListener('click', () => {
        const cita = getCurrentCita();
        if (!cita || cita.estado !== 'PENDIENTE') return;
        modal.classList.remove('active');
        openConfirmModal('APROBADA', cita);
    });

    if (rejectBtn) rejectBtn.addEventListener('click', () => {
        const cita = getCurrentCita();
        if (!cita || cita.estado !== 'PENDIENTE') return;
        modal.classList.remove('active');
        openConfirmModal('RECHAZADA', cita);
    });
}

function ensureConfirmModal() {
    let modal = document.getElementById('confirm-modal');

    if (!modal) {
        ensureStylesheet();
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="confirm-modal">
                <div class="modal-content confirm-modal-content">
                    <div class="modal-header" id="confirm-modal-header">
                        <h2 id="confirm-modal-title"><i class="fas fa-check-circle"></i> Confirmar Acción</h2>
                        <button class="close-modal-btn" id="close-confirm-modal">&times;</button>
                    </div>
                    <div class="modal-body" id="confirm-modal-body">
                        <div class="confirm-action-indicator" id="confirm-action-indicator">
                            <div class="confirm-icon" id="confirm-icon">
                                <i class="fas fa-check"></i>
                            </div>
                            <div class="confirm-text" id="confirm-text">
                                <strong id="confirm-action-label">APROBAR</strong> cita de <span id="confirm-propietario">---</span>
                            </div>
                        </div>
                        <div class="confirm-date-section" id="confirm-date-section">
                            <label for="confirm-fecha-cita">Fecha de la Cita *</label>
                            <input type="date" id="confirm-fecha-cita" name="confirm-fecha-cita">
                        </div>
                        <p class="confirm-info-text" id="confirm-info-text">¿Está seguro de realizar esta acción?</p>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn btn-danger" id="cancel-confirm-btn">Cancelar</button>
                        <button class="modal-btn btn-success" id="execute-confirm-btn">
                            <i class="fas fa-check"></i> Confirmar
                        </button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('confirm-modal');
    }

    if (!confirmBound) {
        bindConfirmEvents(modal);
        confirmBound = true;
    }

    return modal;
}

function bindConfirmEvents(modal) {
    const closeBtn = document.getElementById('close-confirm-modal');
    const cancelBtn = document.getElementById('cancel-confirm-btn');
    const executeBtn = document.getElementById('execute-confirm-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeConfirmModalFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeConfirmModalFn);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeConfirmModalFn();
    });
    if (executeBtn) executeBtn.addEventListener('click', executeConfirmAction);
}

function executeConfirmAction() {
    const executeBtn = document.getElementById('execute-confirm-btn');
    const confirmFechaCita = document.getElementById('confirm-fecha-cita');

    if (pendingAction === 'APROBADA') {
        const fecha = confirmFechaCita.value;
        if (!fecha) {
            alert('Debe seleccionar una fecha para la cita.');
            return;
        }
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        updateCitaStatus(pendingCitaId, 'APROBADA', fecha);
    } else if (pendingAction === 'RECHAZADA') {
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        updateCitaStatus(pendingCitaId, 'RECHAZADA', null);
    }
}

function closeConfirmModalFn() {
    const confirmModal = document.getElementById('confirm-modal');
    const executeBtn = document.getElementById('execute-confirm-btn');

    if (confirmModal) confirmModal.classList.remove('active');
    pendingAction = null;
    pendingCitaId = null;
    if (executeBtn) {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar';
    }
}

async function updateCitaStatus(citaId, estado, fecha_cita) {
    const executeBtn = document.getElementById('execute-confirm-btn');

    try {
        const body = { estado };
        if (fecha_cita) body.fecha_cita = fecha_cita;

        const session = getSession();
        if (session) body.emisor_id = session.id;

        const response = await apiFetch(`/citas/${citaId}/status`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.success) {
            closeConfirmModalFn();
            ensureSuccessModal();
            showSuccessModal(`Cita ${estado.toLowerCase()} exitosamente. Se ha enviado una notificación al cliente.`);
            document.dispatchEvent(new CustomEvent('citas:updated'));
        } else {
            alert(`Error al actualizar la cita: ${result.message}`);
            executeBtn.disabled = false;
            executeBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar';
        }
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        alert('Error de red. Asegúrate de que el backend esté encendido.');
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar';
    }
}

export function getStatusClass(estado) {
    switch (estado) {
        case 'PENDIENTE': return 'status-pendiente';
        case 'APROBADA': return 'status-aprobada';
        case 'RECHAZADA': return 'status-rechazada';
        default: return '';
    }
}

export function getStatusText(estado) {
    switch (estado) {
        case 'PENDIENTE': return 'Pendiente';
        case 'APROBADA': return 'Aprobada';
        case 'RECHAZADA': return 'Rechazada';
        default: return estado;
    }
}

export function formatDateTable(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
