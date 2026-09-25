import { renderFooter } from './Layout.js';

document.addEventListener('DOMContentLoaded', () => {
    renderFooter();
    const navbar = document.querySelector('.navbar');
    
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.padding = '0.8rem 5%';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            navbar.style.padding = '1rem 5%';
            navbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        }
    });

    
    const btnNovedades = document.getElementById('btn-novedades');
    if (btnNovedades) {
        btnNovedades.addEventListener('click', () => {
            window.location.href = 'src/html/Novedad.html';
        });
    }

    const btnAcerca = document.getElementById('btn-acerca');
    if (btnAcerca) {
        btnAcerca.addEventListener('click', () => {
            window.location.href = 'src/html/About.html';
        });
    }

   
    const buttons = document.querySelectorAll('.nav-btn, .auth-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
                e.preventDefault();
                console.log(`Botón clickeado: ${e.target.innerText || 'Icono'}`);
            }
        });
    });

    console.log('VetCare JS Initialized');
});
