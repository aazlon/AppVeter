/**
 * Menú de navegación móvil (hamburguesa).
 *
 * En pantallas <= 768px los enlaces del navbar (.nav-links) se ocultan
 * normalmente; este módulo añade un botón que despliega esos enlaces
 * como panel vertical. Como los botones del menú se generan según el
 * rol del usuario (renderNavbar en Layout.js), cada usuario verá en el
 * desplegable exactamente las opciones que le corresponden.
 */
export function initNavToggle() {
    const navbar = document.getElementById('main-navbar');
    const toggle = document.getElementById('btn-nav-toggle');
    if (!navbar || !toggle || toggle.dataset.bound === '1') return;

    toggle.dataset.bound = '1';

    const icon = toggle.querySelector('i');

    const setOpen = (open) => {
        navbar.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (icon) icon.className = open ? 'fas fa-times' : 'fas fa-bars';
    };

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!navbar.classList.contains('menu-open'));
    });

    // Cerrar al pulsar cualquier opción del menú (enlace o botón)
    navbar.querySelectorAll('.nav-links button, .nav-links a').forEach((el) => {
        el.addEventListener('click', () => setOpen(false));
    });

    // Cerrar al pulsar fuera del navbar
    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target)) setOpen(false);
    });

    // Cerrar con la tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });
}
