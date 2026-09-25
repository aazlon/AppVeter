import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { getSession, getRoleFlags } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr, safeUrl } from './security.js';

const API_URL = '/novedades';

let userData = null;
let isAdmin = false;
let editingId = null;
let currentPage = 1;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    userData = getSession();
    renderLayout();

    if (userData) {
        isAdmin = getRoleFlags(userData).isAdmin;

        if (isAdmin) {
            document.getElementById('novedades-title').textContent = 'Gestionar novedades';
            document.getElementById('admin-form-section').style.display = 'block';
        }

        initNotificationModal(userData);
        const badge = document.getElementById('notification-badge');
        if (badge) loadNotificationCount(badge);

        const novedadForm = document.getElementById('novedad-form');
        const btnCancelForm = document.getElementById('btn-cancel-form');
        const novedadImageInput = document.getElementById('novedad-image');
        const imagePreview = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        const removeImageBtn = document.getElementById('remove-image');
        const filePlaceholder = document.getElementById('file-placeholder');

        novedadImageInput.addEventListener('change', () => {
            const file = novedadImageInput.files[0];
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
            novedadImageInput.value = '';
            imagePreview.style.display = 'none';
            filePlaceholder.style.display = 'flex';
            previewImg.src = '';
        });

        novedadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-form');
            const btnTextSpan = document.getElementById('btn-submit-text');
            if (btnTextSpan) btnTextSpan.textContent = 'Guardando...';
            submitBtn.disabled = true;

            const descripcion = document.getElementById('novedad-desc').value.trim();
            const imageFile = document.getElementById('novedad-image').files[0];

            try {
                let response;
                if (imageFile) {
                    const formData = new FormData();
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
                    const payload = { descripcion, user_id: userData.id };

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
                    resetForm();
                    submitBtn.disabled = false;
                    if (btnTextSpan) btnTextSpan.textContent = 'Publicar novedad';
                    loadNovedades();
                    showToast(editingId ? 'Novedad actualizada correctamente' : 'Novedad publicada correctamente', 'success');
                } else {
                    if (btnTextSpan) btnTextSpan.textContent = editingId ? 'Actualizar novedad' : 'Publicar novedad';
                    submitBtn.disabled = false;
                    showToast(result.message || 'Error al guardar la novedad', 'error');
                }
            } catch (error) {
                console.error('Error completo:', error);
                if (btnTextSpan) btnTextSpan.textContent = editingId ? 'Actualizar novedad' : 'Publicar novedad';
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
    }

    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        if (window.scrollY > 50) {
            navbar.style.padding = '0.8rem 5%';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.style.padding = '1rem 5%';
            navbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        }
    });

    loadNovedades();
});

async function loadNovedades(resetPage = true) {
    if (resetPage) currentPage = 1;
    const grid = document.getElementById('novedades-grid');
    const noNovedades = document.getElementById('no-novedades');
    grid.innerHTML = '<div class="loading-novedades"><div class="spinner"></div> Cargando novedades...</div>';

    try {
        const response = await apiFetch(apiUrl(API_URL, { page: currentPage, limit: 24 }));
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            noNovedades.style.display = 'none';
            totalPages = (result.pagination && result.pagination.totalPages) || 1;
            if (resetPage) grid.innerHTML = '';
            else {
                const existingLoadMore = document.getElementById('novedades-load-more');
                if (existingLoadMore) existingLoadMore.remove();
            }
            result.data.forEach(novedad => renderNovedadCard(novedad, grid));
            renderLoadMore(grid, 'novedades');
        } else if (resetPage) {
            noNovedades.style.display = 'block';
            grid.innerHTML = '';
        } else {
            const existingLoadMore = document.getElementById('novedades-load-more');
            if (existingLoadMore) existingLoadMore.remove();
        }
    } catch (error) {
        console.error('Error al cargar novedades:', error);
        grid.innerHTML = '<div class="loading-novedades"><i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--danger-color)"></i><p>Error al cargar novedades</p></div>';
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
        if (btn.disabled || currentPage >= totalPages) return;
        btn.disabled = true;
        btn.textContent = 'Cargando...';
        currentPage++;
        loadNovedades(false).finally(() => {
            if (document.contains(btn)) {
                btn.disabled = false;
                btn.textContent = 'Cargar más';
            }
        });
    });
    grid.appendChild(btn);
}

function renderNovedadCard(novedad, container) {
    const card = document.createElement('div');
    card.className = 'novedad-card';
    card.style.animation = 'slideUp 0.5s ease-out';

    const imageHtml = novedad.image
        ? `<img src="${escapeAttr(safeUrl(novedad.image))}" alt="Novedad" class="novedad-card-image">`
        : `<div class="novedad-card-image-placeholder"><i class="fas fa-paw"></i></div>`;

    let actionsHtml = '';
    if (isAdmin) {
        actionsHtml = `
            <div class="novedad-card-actions">
                <button class="btn-edit-novedad" data-id="${escapeAttr(novedad.id)}"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete-novedad" data-id="${escapeAttr(novedad.id)}"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        `;
    }

    card.innerHTML = `
        ${imageHtml}
        <div class="novedad-card-body">
            <p class="novedad-card-desc">${escapeHtml(novedad.descripcion)}</p>
        </div>
        ${actionsHtml}
    `;

    container.appendChild(card);

    if (isAdmin) {
        card.querySelector('.btn-edit-novedad').addEventListener('click', () => editNovedad(novedad));
        card.querySelector('.btn-delete-novedad').addEventListener('click', () => deleteNovedad(novedad.id));
    }
}

function editNovedad(novedad) {
    editingId = novedad.id;
    document.getElementById('novedad-id').value = novedad.id;
    document.getElementById('novedad-desc').value = novedad.descripcion;
    document.getElementById('form-title').innerHTML = '<i class="fas fa-edit"></i> Editar novedad';
    const submitSpan = document.getElementById('btn-submit-text');
    if (submitSpan) submitSpan.textContent = 'Actualizar novedad';
    document.getElementById('btn-cancel-form').style.display = 'block';

    if (novedad.image) {
        document.getElementById('preview-img').src = novedad.image;
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('file-placeholder').style.display = 'none';
    }

    document.getElementById('admin-form-section').scrollIntoView({ behavior: 'smooth' });
}

const deletesInFlight = new Set();

async function deleteNovedad(id) {
    if (deletesInFlight.has(id)) return;
    if (!confirm('¿Estás seguro de eliminar esta novedad?')) return;

    deletesInFlight.add(id);
    try {
        const response = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            loadNovedades(true);
            showToast('Novedad eliminada correctamente', 'success');
        } else {
            showToast(result.message || 'Error al eliminar la novedad', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        deletesInFlight.delete(id);
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('novedad-form').reset();
    document.getElementById('novedad-id').value = '';
    document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Nueva novedad';
    const submitSpan = document.getElementById('btn-submit-text');
    if (submitSpan) submitSpan.textContent = 'Publicar novedad';
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
