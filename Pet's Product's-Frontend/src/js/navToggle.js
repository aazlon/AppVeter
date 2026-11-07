
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


    navbar.querySelectorAll('.nav-links button, .nav-links a').forEach((el) => {
        el.addEventListener('click', () => setOpen(false));
    });


    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target)) setOpen(false);
    });


    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });
}
