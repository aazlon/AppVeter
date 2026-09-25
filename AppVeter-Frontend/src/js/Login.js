import { renderFooter } from './Layout.js';
import { apiFetch } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    renderFooter();
    const loginForm = document.getElementById('loginForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const errorMessage = document.getElementById('errorMessage');
    const recoverPassword = document.getElementById('recoverPassword');

    const navbar = document.querySelector('.navbar');
    document.getElementById('main-navbar').style.padding = '1rem 5%';

    document.getElementById('btn-inicio').addEventListener('click', () => {
        window.location.href = '../../Index.html';
    });

    document.getElementById('btn-novedades').addEventListener('click', () => {
        window.location.href = './Novedad.html';
    });

    document.getElementById('btn-acerca').addEventListener('click', () => {
        window.location.href = './About.html';
    });

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.padding = '0.8rem 5%';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.style.padding = '1rem 5%';
            navbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        }
    });

    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorMessage.textContent = '';
        btnSubmit.classList.add('loading');
        btnSubmit.disabled = true;

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await apiFetch('/users/login', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                const { session_token, ...safeUser } = result.data || {};
                localStorage.setItem('user', JSON.stringify(safeUser));
                if (session_token) {
                    sessionStorage.setItem('session_token', session_token);
                }
                window.location.href = './UserScreen.html';
            } else {
                errorMessage.textContent = result.message || 'Error al iniciar sesión';
            }
        } catch (error) {
            console.error('Error:', error);
            errorMessage.textContent = 'No se pudo conectar con el servidor';
        } finally {
            btnSubmit.classList.remove('loading');
            btnSubmit.disabled = false;
        }
    });

    
    recoverPassword.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = './ForgotPassword.html';
    });
});
