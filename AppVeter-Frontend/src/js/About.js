import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { getSession } from './Roles.js';
import { renderLayout } from './Layout.js';

document.addEventListener('DOMContentLoaded', () => {
    const userData = getSession();
    renderLayout();

    if (userData) {
        initNotificationModal(userData);
        const badge = document.getElementById('notification-badge');
        if (badge) loadNotificationCount(badge);
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

    console.log('About Page Initialized');
});
