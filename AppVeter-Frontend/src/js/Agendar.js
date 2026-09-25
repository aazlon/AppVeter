import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { showSuccessModal } from './SuccessModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const { isAdmin, isVeterinario, isCliente } = getRoleFlags(userData);

    if (!isCliente && !isAdmin && !isVeterinario) {
        alert('Acceso exclusivo para clientes. Redirigiendo...');
        window.location.href = './UserScreen.html';
        return;
    }

    const notificationBadge = document.getElementById('notification-badge');
    const citaForm = document.getElementById('citaForm');
    const submitCitaBtn = document.getElementById('submit-cita-btn');

    // Obtener perfil actualizado del usuario desde la base de datos
    async function loadUserProfile() {
        try {
            const response = await apiFetch(`/users/${userData.id}`);
            const result = await response.json();

            if (result.success) {
                const profile = result.data;
                const nombreInput = document.getElementById('nombre_propietario');
                const ciInput = document.getElementById('ci');
                const telefonoInput = document.getElementById('telefono');
                const correoInput = document.getElementById('correo_electronico');
                const direccionInput = document.getElementById('direccion');

                const nombreCompleto = `${profile.name || ''} ${profile.lastname || ''}`.trim();
                if (nombreCompleto) {
                    nombreInput.value = nombreCompleto;
                    nombreInput.readOnly = true;
                }
                if (profile.cedula) {
                    ciInput.value = profile.cedula;
                    ciInput.readOnly = true;
                }
                if (profile.phone) {
                    telefonoInput.value = profile.phone;
                    telefonoInput.readOnly = true;
                }
                if (profile.email) {
                    correoInput.value = profile.email;
                    correoInput.readOnly = true;
                }
                if (profile.direccion) {
                    direccionInput.value = profile.direccion;
                    direccionInput.readOnly = true;
                }
            }
        } catch (error) {
            console.warn('No se pudo obtener el perfil del usuario, usando datos locales:', error);
            // Fallback: llenar con datos de localStorage
            const correoInput = document.getElementById('correo_electronico');
            if (userData.email && correoInput) {
                correoInput.value = userData.email;
                correoInput.readOnly = true;
            }
        }
    }

    loadUserProfile();

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);

    citaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            user_id: userData.id,
            nombre_propietario: document.getElementById('nombre_propietario').value.trim(),
            ci: document.getElementById('ci').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            direccion: document.getElementById('direccion').value.trim(),
            correo_electronico: document.getElementById('correo_electronico').value.trim(),
            motivo_cita: document.getElementById('motivo_cita').value.trim(),
            fecha_solicitud: new Date().toISOString()
        };

        try {
            submitCitaBtn.disabled = true;
            submitCitaBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

            const response = await apiFetch('/citas/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showSuccessModal('¡Solicitud de cita enviada exitosamente! Te notificaremos cuando sea aprobada o rechazada.', null);
                citaForm.reset();
                loadUserProfile();
            } else {
                showSuccessModal(`Error al enviar la solicitud: ${result.message}`, null);
            }
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            showSuccessModal('Error de red. Asegúrate de que el backend esté encendido.', null);
        } finally {
            submitCitaBtn.disabled = false;
            submitCitaBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitud de Cita';
        }
    });
});
