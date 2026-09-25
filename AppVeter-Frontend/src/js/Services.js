import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr, safeUrl } from './security.js';

const API_URL = '/services';

let userData = null;
let isAdmin = false;
let editingId = null;
let currentPage = 1;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');

    userData = requireAuth();
    if (!userData) return;

    renderLayout();

    ({ isAdmin } = getRoleFlags(userData));

    const notificationBadge = document.getElementById('notification-badge');
    const servicesTitle = document.getElementById('services-title');
    const adminFormSection = document.getElementById('admin-form-section');
    const serviceForm = document.getElementById('service-form');
    const btnCancelForm = document.getElementById('btn-cancel-form');
    const btnSubmitText = document.getElementById('btn-submit-text');
    const formTitle = document.getElementById('form-title');

    if (isAdmin) {
        servicesTitle.textContent = 'Gestionar servicios';
        adminFormSection.style.display = 'block';
    }

    loadServices();

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);


    const serviceImageInput = document.getElementById('service-image');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImageBtn = document.getElementById('remove-image');
    const filePlaceholder = document.getElementById('file-placeholder');

    serviceImageInput.addEventListener('change', () => {
        const file = serviceImageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                imagePreview.style.display = 'block';
                filePlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        serviceImageInput.value = '';
        imagePreview.style.display = 'none';
        filePlaceholder.style.display = 'flex';
        previewImg.src = '';
    });


    serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-form');
        const btnTextSpan = document.getElementById('btn-submit-text');
        if (btnTextSpan) btnTextSpan.textContent = 'Guardando...';
        submitBtn.disabled = true;

        const titulo = document.getElementById('service-title').value.trim();
        const descripcion = document.getElementById('service-desc').value.trim();
        const imageFile = document.getElementById('service-image').files[0];
        const serviceId = document.getElementById('service-id').value;

        try {

            let response;
            if (imageFile) {
                const formData = new FormData();
                formData.append('titulo', titulo);
                formData.append('descripcion', descripcion);
                formData.append('user_id', userData.id);
                formData.append('image', imageFile);

                if (editingId) {
                    response = await apiFetch(`${API_URL}/${editingId}/with-image`, {
                        method: 'PUT',
                        body: formData
                    });
                } else {
                    response = await apiFetch(`${API_URL}/with-image`, {
                        method: 'POST',
                        body: formData
                    });
                }
            } else {
                const payload = { titulo, descripcion, user_id: userData.id };

                if (editingId) {
                    response = await apiFetch(`${API_URL}/${editingId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    response = await apiFetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
            }

            const result = await response.json();

            if (result.success) {
                const wasEditing = editingId;
                resetForm();
                submitBtn.disabled = false;
                if (btnTextSpan) btnTextSpan.textContent = 'Publicar servicio';
                loadServices();
                showToast(wasEditing ? 'Servicio actualizado correctamente' : 'Servicio publicado correctamente', 'success');
            } else {
                if (btnTextSpan) btnTextSpan.textContent = editingId ? 'Actualizar servicio' : 'Publicar servicio';
                submitBtn.disabled = false;
                showToast(result.message || 'Error al guardar el servicio', 'error');
            }
        } catch (error) {
            console.error('Error completo:', error);
            if (btnTextSpan) btnTextSpan.textContent = editingId ? 'Actualizar servicio' : 'Publicar servicio';
            submitBtn.disabled = false;
            const msg = error.message || String(error);
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('load')) {
                showToast('No se pudo conectar con el servidor. ¿El backend está corriendo en http://localhost:3000?', 'error');
            } else {
                showToast('Error: ' + msg, 'error');
            }
        }
    });


    btnCancelForm.addEventListener('click', resetForm);
});

async function loadServices(resetPage = true) {
    if (resetPage) currentPage = 1;
    const grid = document.getElementById('services-grid');
    const noServices = document.getElementById('no-services');
    grid.innerHTML = '<div class="loading-services"><div class="spinner"></div> Cargando servicios...</div>';

    try {
        const response = await apiFetch(apiUrl(API_URL, { page: currentPage, limit: 24 }));
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            noServices.style.display = 'none';
            totalPages = (result.pagination && result.pagination.totalPages) || 1;
            if (resetPage) grid.innerHTML = '';
            else {
                const existingLoadMore = document.getElementById('services-load-more');
                if (existingLoadMore) existingLoadMore.remove();
            }
            result.data.forEach(service => renderServiceCard(service, grid));
            renderLoadMore(grid, 'services');
        } else if (resetPage) {
            noServices.style.display = 'block';
            grid.innerHTML = '';
        } else {
            const existingLoadMore = document.getElementById('services-load-more');
            if (existingLoadMore) existingLoadMore.remove();
        }
    } catch (error) {
        console.error('Error al cargar servicios:', error);
        grid.innerHTML = '<div class="loading-services"><i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--danger-color)"></i><p>Error al cargar servicios</p></div>';
    }
}

function renderLoadMore(grid, prefix) {
    if (currentPage >= totalPages) return;
    const btn = document.createElement('button');
    btn.id = `${prefix}-load-more`;
    btn.className = 'btn-load-more';
    btn.style.cssText = 'grid-column:1/-1;padding:0.8rem;border-radius:10px;border:1px solid var(--border-color);background:transparent;cursor:pointer;font-weight:600;';
    btn.textContent = 'Cargar más';
    btn.addEventListener('click', () => {
        currentPage++;
        loadServices(false);
    });
    grid.appendChild(btn);
}

function renderServiceCard(service, container) {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.style.animation = 'slideUp 0.5s ease-out';

    const imageHtml = service.image
        ? `<img src="${escapeAttr(safeUrl(service.image))}" alt="${escapeAttr(service.titulo)}" class="service-card-image">`
        : `<div class="service-card-image-placeholder"><i class="fas fa-paw"></i></div>`;

    let actionsHtml = '';
    if (isAdmin) {
        actionsHtml = `
            <div class="service-card-actions">
                <button class="btn-edit-service" data-id="${escapeAttr(service.id)}"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete-service" data-id="${escapeAttr(service.id)}"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        `;
    }

    card.innerHTML = `
        ${imageHtml}
        <div class="service-card-body">
            <h3 class="service-card-title">${escapeHtml(service.titulo)}</h3>
            <p class="service-card-desc">${escapeHtml(service.descripcion)}</p>
        </div>
        ${actionsHtml}
    `;

    container.appendChild(card);

    if (isAdmin) {
        card.querySelector('.btn-edit-service').addEventListener('click', () => editService(service));
        card.querySelector('.btn-delete-service').addEventListener('click', () => deleteService(service.id));
    }
}

function editService(service) {
    editingId = service.id;
    document.getElementById('service-id').value = service.id;
    document.getElementById('service-title').value = service.titulo;
    document.getElementById('service-desc').value = service.descripcion;
    document.getElementById('form-title').innerHTML = '<i class="fas fa-edit"></i> Editar servicio';
    const submitSpan = document.getElementById('btn-submit-text');
    if (submitSpan) submitSpan.textContent = 'Actualizar servicio';
    document.getElementById('btn-cancel-form').style.display = 'block';

    if (service.image) {
        document.getElementById('preview-img').src = service.image;
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('file-placeholder').style.display = 'none';
    }

    document.getElementById('admin-form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteService(id) {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    try {
        const response = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            loadServices(true);
            showToast('Servicio eliminado correctamente', 'success');
        } else {
            showToast(result.message || 'Error al eliminar el servicio', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('service-form').reset();
    document.getElementById('service-id').value = '';
    document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Nuevo servicio';
    const submitSpan = document.getElementById('btn-submit-text');
    if (submitSpan) submitSpan.textContent = 'Publicar servicio';
    document.getElementById('btn-cancel-form').style.display = 'none';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('file-placeholder').style.display = 'flex';
    document.getElementById('preview-img').src = '';
}

function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        fontWeight: '600',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s ease-out',
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        color: '#ffffff',
        fontSize: '0.95rem'
    });

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
