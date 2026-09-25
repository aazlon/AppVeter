import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { showSuccessModal } from './SuccessModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();
    const { isAdmin } = getRoleFlags(userData);

    if (!isAdmin) {
        window.location.href = './UserScreen.html';
        return;
    }

    const userNameDisplay = document.getElementById('user-name');
    const userAvatarDisplay = document.getElementById('user-avatar');
    const btnDeleteRecep = document.getElementById('btn-delete-recep');
    const btnDeleteVeter = document.getElementById('btn-delete-veter');
    const notificationBadge = document.getElementById('notification-badge');

    const form = document.getElementById('registerVeterForm');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const errorMessage = document.getElementById('errorMessage');
    const btnSubmit = document.getElementById('btnSubmit');

    const fullName = userData.name || userData.nombre || userData.username || 'Usuario';
    userNameDisplay.textContent = fullName;

    if (userData.image || userData.foto) {
        userAvatarDisplay.src = userData.image || userData.foto;
    } else {
        userAvatarDisplay.src = '../assets/cliente.jpg';
    }

    if (btnDeleteRecep) {
        btnDeleteRecep.style.display = 'inline-block';
        btnDeleteRecep.addEventListener('click', () => window.location.href = './DeleteRecep.html');
    }
    if (btnDeleteVeter) {
        btnDeleteVeter.style.display = 'inline-block';
        btnDeleteVeter.addEventListener('click', () => window.location.href = './DeleteVeter.html');
    }

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);

    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    });

    function clearFieldErrors() {
        document.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
            el.classList.remove('visible');
        });
        document.querySelectorAll('.form-group.input-error').forEach(el => {
            el.classList.remove('input-error');
        });
    }

    function showFieldError(fieldId, message) {
        const span = document.querySelector(`.field-error[data-field="${fieldId}"]`);
        if (span) {
            span.textContent = message;
            span.classList.add('visible');
            const formGroup = span.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add('input-error');
            }
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorMessage.textContent = '';
        clearFieldErrors();

        const name = document.getElementById('name').value.trim();
        const lastname = document.getElementById('lastname').value.trim();
        const email = document.getElementById('email').value.trim();
        const username = document.getElementById('username').value.trim();
        const cedula = document.getElementById('cedula').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmpassword = document.getElementById('confirmpassword').value;
        const file = imageInput.files[0];

        const lettersRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        const numbersRegex = /^[0-9]+$/;
        const usernameRegex = /^[a-zA-Z0-9_]+$/;

        if (!name || !lastname || !email || !username || !cedula || !phone || !password || !confirmpassword) {
            showError('Por favor completa todos los campos requeridos.');
            return;
        }

        if (!usernameRegex.test(username)) {
            showError('El nombre de usuario solo puede contener letras, números y guiones bajos (_).');
            return;
        }

        if (!lettersRegex.test(name) || !lettersRegex.test(lastname)) {
            showError('El nombre y apellido solo pueden contener letras.');
            return;
        }

        if (!numbersRegex.test(cedula)) {
            showError('La cédula solo puede contener números.');
            return;
        }

        if (!numbersRegex.test(phone)) {
            showError('El teléfono solo puede contener números.');
            return;
        }

        if (password.length < 8) {
            showError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            showError('La contraseña debe incluir mayúsculas, minúsculas y números.');
            return;
        }

        if (password !== confirmpassword) {
            showError('Las contraseñas no coinciden.');
            return;
        }

        const user = {
            name,
            lastname,
            email,
            username,
            cedula,
            phone,
            password
        };

        const formData = new FormData();
        formData.append('user', JSON.stringify(user));

        if (file) {
            formData.append('image', file);
        }

        btnSubmit.classList.add('loading');
        btnSubmit.disabled = true;

        try {
            const response = await apiFetch('/users/register-veterinarian', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showSuccessModal('El registro se ha realizado correctamente', './UserScreen.html');
            } else {
                if (result.errors && Array.isArray(result.errors)) {
                    let hasFieldErrors = false;
                    result.errors.forEach(err => {
                        if (err.field && err.message) {
                            showFieldError(err.field, err.message);
                            hasFieldErrors = true;
                        }
                    });
                    if (!hasFieldErrors) {
                        showError(result.message || 'Error al registrar el veterinario.');
                    }
                } else if (result.field && result.message) {
                    showFieldError(result.field, result.message);
                } else {
                    showError(result.message || 'Error al registrar el veterinario.');
                }
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
});