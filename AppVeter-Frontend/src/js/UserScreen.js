import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = requireAuth();
    if (!userData) return;

    renderLayout();

    const welcomeNameDisplay = document.getElementById('welcome-name');
    const notificationBadge = document.getElementById('notification-badge');
    const cardAppointment = document.getElementById('card-appointment');
    const cardServices = document.getElementById('card-services');
    const cardRecepcionistas = document.getElementById('card-recepcionistas');
    const cardVeterinarios = document.getElementById('card-veterinarios');

    const { isAdmin, isRecepcionista, isVeterinario } = getRoleFlags(userData);

    const fullName = userData.name || userData.nombre || userData.username || 'Usuario';
    if (welcomeNameDisplay) welcomeNameDisplay.textContent = fullName;

    if (isAdmin) {
        if (cardRecepcionistas) cardRecepcionistas.style.display = 'flex';
        if (cardVeterinarios) cardVeterinarios.style.display = 'flex';
    }

    if (isAdmin || isVeterinario) {
        cardAppointment.style.display = 'none';
    } else {
        const cardTitle = cardAppointment.querySelector('h3');
        const cardDesc = cardAppointment.querySelector('p');

        if (isRecepcionista) {
            cardTitle.textContent = 'Gestionar cita';
            cardDesc.textContent = 'Revisa, aprueba o rechaza las solicitudes de citas de los clientes.';
        } else {
            cardTitle.textContent = 'Agendar cita';
            cardDesc.textContent = 'Reserva un espacio con nuestros especialistas para el cuidado de tu mejor amigo.';
        }
    }

    if (isAdmin && cardServices) {
        const servicesTitle = cardServices.querySelector('h3');
        const servicesDesc = cardServices.querySelector('p');
        if (servicesTitle) servicesTitle.textContent = 'Gestionar servicios';
        if (servicesDesc) servicesDesc.textContent = 'Crea, edita y administra los servicios ofrecidos por la clínica.';
    }

    initNotificationModal(userData);
    loadNotificationCount(notificationBadge);

    if (cardAppointment) {
        cardAppointment.addEventListener('click', () => {
            const esRecep = isRecepcionista;
            window.location.href = esRecep ? './GestionarCitas.html' : './Agendar.html';
        });
    }

    if (cardServices) {
        cardServices.addEventListener('click', () => {
            window.location.href = isAdmin ? './Services.html?mode=admin' : './Services.html?mode=view';
        });
    }

    if (cardRecepcionistas) {
        cardRecepcionistas.addEventListener('click', () => {
            window.location.href = './DeleteRecep.html';
        });
    }

    if (cardVeterinarios) {
        cardVeterinarios.addEventListener('click', () => {
            window.location.href = './DeleteVeter.html';
        });
    }
});
