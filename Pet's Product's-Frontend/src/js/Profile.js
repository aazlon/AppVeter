import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { requireAuth, getRoleFlags } from './Roles.js';
import { renderLayout } from './Layout.js';
import { showSuccessModal } from './SuccessModal.js';
import { apiFetch, logoutRequest } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const userNameDisplay = document.getElementById('user-name');
    const userAvatarDisplay = document.getElementById('user-avatar');
    const notificationBadge = document.getElementById('notification-badge');

    const form = document.getElementById('profileForm');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const errorMessage = document.getElementById('errorMessage');
    const btnSubmit = document.getElementById('btnSubmit');

    initNotificationModal(userData);
    if (notificationBadge) loadNotificationCount(notificationBadge);

    const nameInput = document.getElementById('name');
    const lastnameInput = document.getElementById('lastname');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const cedulaInput = document.getElementById('cedula');
    const phoneInput = document.getElementById('phone');

    async function loadProfile() {
        try {
            const response = await apiFetch(`/users/${userData.id}`);
            const result = await response.json();

            if (result.success) {
                const profile = result.data;
                nameInput.value = profile.name || '';
                lastnameInput.value = profile.lastname || '';
                usernameInput.value = profile.username || '';
                emailInput.value = profile.email || '';
                cedulaInput.value = profile.cedula || '';
                phoneInput.value = profile.phone || '';

                if (profile.image) {
                    imagePreview.src = profile.image;
                    userAvatarDisplay.src = profile.image;
                }

                const updatedUser = { ...userData, ...profile };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } catch (error) {
            console.warn('No se pudo obtener el perfil, usando datos locales:', error);
            nameInput.value = userData.name || '';
            lastnameInput.value = userData.lastname || '';
            usernameInput.value = userData.username || '';
            emailInput.value = userData.email || '';
            cedulaInput.value = userData.cedula || '';
            phoneInput.value = userData.phone || '';
        }
    }

    loadProfile();

    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorMessage.textContent = '';

        const username = usernameInput.value.trim();
        const phone = phoneInput.value.trim();
        const file = imageInput.files[0];

        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        const numbersRegex = /^[0-9]+$/;

        if (!username) {
            showError('El nombre de usuario es requerido.');
            return;
        }

        if (!usernameRegex.test(username)) {
            showError('El nombre de usuario solo puede contener letras, números y guiones bajos (_).');
            return;
        }

        if (!phone) {
            showError('El teléfono es requerido.');
            return;
        }

        if (!numbersRegex.test(phone)) {
            showError('El teléfono solo puede contener números.');
            return;
        }

        const user = {
            username: username,
            phone: phone
        };

        const formData = new FormData();
        formData.append('user', JSON.stringify(user));

        if (file) {
            formData.append('image', file);
        }

        btnSubmit.classList.add('loading');
        btnSubmit.disabled = true;

        try {
            const response = await apiFetch(`/users/${userData.id}`, {
                method: 'PUT',
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showSuccessModal('¡Perfil actualizado correctamente!');

                const updatedUser = {
                    ...userData,
                    username: username,
                    phone: phone
                };

                if (result.data && result.data.image) {
                    updatedUser.image = result.data.image;
                }

                localStorage.setItem('user', JSON.stringify(updatedUser));
                userNameDisplay.textContent = updatedUser.name || updatedUser.username || 'Usuario';
                if (updatedUser.image) {
                    userAvatarDisplay.src = updatedUser.image;
                }
            } else {
                showError(result.message || 'Error al actualizar el perfil.');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Error de conexión con el servidor.');
        } finally {
            btnSubmit.classList.remove('loading');
            btnSubmit.disabled = false;
        }
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.animation = 'none';
        errorMessage.offsetHeight;
        errorMessage.style.animation = 'shake 0.5s';
    }

    const btnDeleteAccount = document.getElementById('btnDeleteAccount');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const btnConfirmNo = document.getElementById('btnConfirmNo');
    const btnConfirmYes = document.getElementById('btnConfirmYes');

    const { isCliente, isRecepcionista, isVeterinario } = getRoleFlags(userData);
    if (btnDeleteAccount && (isCliente || isRecepcionista || isVeterinario)) {
        btnDeleteAccount.hidden = false;
    }

    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', () => {
            errorMessage.textContent = '';
            deleteConfirmModal.classList.add('active');
        });
    }

    if (btnConfirmNo) {
        btnConfirmNo.addEventListener('click', () => {
            deleteConfirmModal.classList.remove('active');
        });
    }

    if (btnConfirmYes) {
        btnConfirmYes.addEventListener('click', async () => {
            btnConfirmYes.disabled = true;
            btnConfirmYes.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btnConfirmNo.disabled = true;

            try {
                const response = await apiFetch(`/users/${userData.id}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    await logoutRequest();
                    deleteConfirmModal.classList.remove('active');
                    showSuccessModal('Cuenta eliminada satisfactoriamente', '../../Index.html');
                } else {
                    deleteConfirmModal.classList.remove('active');
                    showError(result.message || 'Error al eliminar la cuenta.');
                }
            } catch (error) {
                console.error('Error:', error);
                deleteConfirmModal.classList.remove('active');
                showError('Error de conexión con el servidor.');
            } finally {
                btnConfirmYes.disabled = false;
                btnConfirmYes.textContent = 'Sí';
                btnConfirmNo.disabled = false;
            }
        });
    }
});
