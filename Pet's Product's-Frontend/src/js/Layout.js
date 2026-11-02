import { getSession, getRoleFlags } from './Roles.js';
import { initLegalModal } from './LegalModal.js';
import { logoutRequest } from './api.js';
import { initNavToggle } from './navToggle.js';
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

/* ============================================================
   Ubicación de la campana de notificaciones (cliente / recepcionista)

   En escritorio la campana vive dentro de .nav-links, junto al resto de
   botones. En vista responsive (<=768px) esos enlaces se esconden dentro
   del menú hamburguesa, así que la campana se mueve al contenedor
   .nav-right, justo a la izquierda del botón de perfil, para que siga
   siendo visible sin abrir el menú. Al volver a escritorio regresa a
   .nav-links.

   Se desplaza EL MISMO nodo del DOM (no se clona), por lo que los
   listeners y las referencias que guardan NotificationModal.js,
   AllNotifications.js y el resto de páginas sobre #btn-notifications y
   #notification-badge siguen siendo válidos.
   ============================================================ */
const RESPONSIVE_QUERY = '(max-width: 768px)';
let bellViewportBound = false;

function syncBellPlacement() {
    const bell = document.getElementById('btn-notifications');
    const navbar = document.getElementById('main-navbar');
    if (!bell || !navbar) return;

    const profile = document.getElementById('user-profile');
    const links = navbar.querySelector('.nav-links');
    const isResponsive = window.matchMedia(RESPONSIVE_QUERY).matches;

    if (isResponsive && profile && profile.parentElement) {
        // Falta moverlo, o quedó en otra posición dentro de .nav-right
        if (bell.parentElement !== profile.parentElement || bell.nextElementSibling !== profile) {
            profile.parentElement.insertBefore(bell, profile);
        }
    } else if (links && bell.parentElement !== links) {
        links.appendChild(bell);
    }
}

function watchBellPlacement() {
    syncBellPlacement();
    if (bellViewportBound) return;
    bellViewportBound = true;

    const onChange = () => syncBellPlacement();
    const mq = window.matchMedia(RESPONSIVE_QUERY);
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
        mq.addListener(onChange);
    }
}

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
            <button class="nav-toggle" id="btn-nav-toggle" aria-label="Abrir menú de navegación" aria-expanded="false">
                <i class="fas fa-bars"></i>
            </button>
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

    // En vista responsive la campana sale del menú desplegable y queda
    // justo a la izquierda del botón de perfil (.nav-right).
    if (showBell) watchBellPlacement();

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
            <button class="nav-toggle" id="btn-nav-toggle" aria-label="Abrir menú de navegación" aria-expanded="false">
                <i class="fas fa-bars"></i>
            </button>
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

    initNavToggle();

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

    initNavToggle();

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
