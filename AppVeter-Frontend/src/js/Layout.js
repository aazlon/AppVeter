import { getSession, getRoleFlags } from './Roles.js';
import { initLegalModal } from './LegalModal.js';
import { logoutRequest } from './api.js';
import { escapeHtml, escapeAttr, safeUrl } from './security.js';

const ACTIVE_MAP = {
    'userscreen.html': 'btn-dashboard',
    'novedad.html': 'btn-novedades',
    'about.html': 'btn-acerca',
    'registerrecep.html': 'btn-register-recep',
    'registerveter.html': 'btn-register-veter',
    'registerclient.html': 'btn-register-client'
};

const FOOTER_HTML = `
    <footer>
        <div class="footer-container">
            <div class="footer-left">
                <div class="footer-social-section">
                    <span class="footer-social-title">Redes Sociales</span>
                    <div class="social-icons">
                        <a href="https://www.instagram.com/pets.products2022/" class="social-btn" title="Instagram"><i class="fab fa-instagram"></i></a>
                    </div>
                </div>
                <div class="footer-legal-links">
                    <button type="button" class="footer-legal-link" data-legal="privacy">Política de Privacidad</button>
                    <button type="button" class="footer-legal-link" data-legal="terms">Términos y Condiciones</button>
                </div>
            </div>
            <div class="footer-right">
                <p class="footer-copy">&copy; Pets Products 2022 C.A. Todos los derechos reservados.</p>
            </div>
        </div>
    </footer>`;

let handlersBound = false;
let guestHandlersBound = false;

function getActiveId() {
    const file = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return ACTIVE_MAP[file] || null;
}

function vis(visible) {
    return visible ? 'inline-block' : 'none';
}

function activeClass(id, activeId) {
    return id === activeId ? ' active' : '';
}

function getOrCreateRoot(id, place) {
    let root = document.getElementById(id);
    if (!root) {
        root = document.createElement('div');
        root.id = id;
        if (place === 'start') {
            document.body.prepend(root);
        } else {
            document.body.appendChild(root);
        }
    }
    return root;
}

export function renderNavbar() {
    const user = getSession();
    if (!user) return false;

    const { isAdmin, isRecepcionista, isCliente, isVeterinario } = getRoleFlags(user);
    const activeId = getActiveId();
    const fullName = escapeHtml(user.name || user.nombre || user.username || 'Usuario');
    const avatarSrc = escapeAttr(safeUrl(user.image || user.foto, '../assets/cliente.jpg'));
    const showBell = isCliente || isRecepcionista;

    const html = `
    <nav class="navbar" id="main-navbar">
        <div class="nav-left">
            <div class="logo-container">
                <span class="logo-text">Pets Products 2022 C.A</span>
            </div>
            <div class="nav-links">
                <button class="nav-btn${activeClass('btn-dashboard', activeId)}" id="btn-dashboard">Panel Principal</button>
                <button class="nav-btn${activeClass('btn-novedades', activeId)}" id="btn-novedades">Novedades</button>
                <button class="nav-btn${activeClass('btn-acerca', activeId)}" id="btn-acerca">Acerca de</button>
                <button class="nav-btn${activeClass('btn-register-recep', activeId)}" id="btn-register-recep" style="display: ${vis(isAdmin)};">Registrar recepcionista</button>
                <button class="nav-btn${activeClass('btn-register-veter', activeId)}" id="btn-register-veter" style="display: ${vis(isAdmin)};">Registrar veterinario</button>
                <button class="nav-btn${activeClass('btn-register-client', activeId)}" id="btn-register-client" style="display: ${vis(isAdmin || isVeterinario)};">Guardar registro</button>
                <button class="nav-icon-btn" id="btn-notifications" style="display: ${vis(showBell)};">
                    <img src="../assets/campana.png" alt="Notificaciones" class="nav-icon-img">
                    <span class="notification-badge" id="notification-badge">0</span>
                </button>
            </div>
        </div>
        <div class="nav-right">
            <div class="user-profile" id="user-profile">
                <span class="user-name" id="user-name">${fullName}</span>
                <div class="user-avatar-container">
                    <img src="${avatarSrc}" alt="Perfil" class="user-avatar" id="user-avatar">
                </div>
            </div>
            <button class="auth-btn btn-logout" id="btn-logout">Salir</button>
        </div>
    </nav>`;

    getOrCreateRoot('navbar-root', 'start').innerHTML = html;
    return true;
}

export function renderFooter() {
    getOrCreateRoot('footer-root', 'end').innerHTML = FOOTER_HTML;
    initLegalModal();
}

export function renderGuestNavbar() {
    const activeId = getActiveId();

    const html = `
    <nav class="navbar" id="main-navbar">
        <div class="nav-left">
            <div class="logo-container">
                <span class="logo-text">Pets Products 2022 C.A</span>
            </div>
            <div class="nav-links">
                <button class="nav-btn${activeClass('btn-inicio', activeId)}" id="btn-inicio">Inicio</button>
                <button class="nav-btn${activeClass('btn-novedades', activeId)}" id="btn-novedades">Novedades</button>
                <button class="nav-btn${activeClass('btn-acerca', activeId)}" id="btn-acerca">Acerca de</button>
            </div>
        </div>
        <div class="nav-right">
            <a href="./Login.html" class="auth-btn btn-login">Iniciar sesión</a>
            <a href="./Register.html" class="auth-btn btn-register">Regístrate</a>
        </div>
    </nav>`;

    getOrCreateRoot('navbar-root', 'start').innerHTML = html;
    return true;
}

function bindGuestHandlers() {
    if (guestHandlersBound) return;
    guestHandlersBound = true;

    const go = (id, href) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { window.location.href = href; });
    };

    go('btn-inicio', '../../Index.html');
    go('btn-novedades', './Novedad.html');
    go('btn-acerca', './About.html');
}

function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;

    const go = (id, href) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { window.location.href = href; });
    };

    go('btn-dashboard', './UserScreen.html');
    go('btn-novedades', './Novedad.html');
    go('btn-acerca', './About.html');
    go('btn-register-recep', './RegisterRecep.html');
    go('btn-register-veter', './RegisterVeter.html');
    go('btn-register-client', './RegisterClient.html');

    const profile = document.getElementById('user-profile');
    if (profile) {
        profile.style.cursor = 'pointer';
        profile.addEventListener('click', () => { window.location.href = './Profile.html'; });
    }

    const logout = document.getElementById('btn-logout');
    if (logout) {
        logout.addEventListener('click', async () => {
            await logoutRequest();
            window.location.href = '../../Index.html';
        });
    }
}

export function renderLayout() {
    let navbarRendered;
    if (getSession()) {
        navbarRendered = renderNavbar();
        if (navbarRendered) bindHandlers();
    } else {
        navbarRendered = renderGuestNavbar();
        if (navbarRendered) bindGuestHandlers();
    }
    renderFooter();
    return navbarRendered;
}
