let initialized = false;
let confirmHandler = null;
let running = false;

function ensureStylesheet() {
    if (document.querySelector('link[href*="LogoutModal.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/LogoutModal.css', import.meta.url).href;
    document.head.appendChild(link);
}

function ensureModal() {
    if (document.getElementById('logout-confirm-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div class="logout-confirm-modal" id="logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-question">
            <div class="logout-confirm-content">
                <div class="logout-confirm-icon">
                    <i class="fas fa-sign-out-alt"></i>
                </div>
                <p class="logout-confirm-message" id="logout-confirm-question">¿Estás seguro de cerrar sesión?</p>
                <div class="logout-confirm-actions">
                    <button type="button" class="logout-confirm-no" id="logout-confirm-no">No</button>
                    <button type="button" class="logout-confirm-yes" id="logout-confirm-yes">Sí</button>
                </div>
            </div>
        </div>
    `);
}

function lockScroll(locked) {
    document.body.style.overflow = locked ? 'hidden' : '';
}

export function closeLogoutModal() {
    const modal = document.getElementById('logout-confirm-modal');
    if (modal) modal.classList.remove('active');
    lockScroll(false);
}

export function initLogoutModal() {
    ensureStylesheet();
    ensureModal();

    if (initialized) return;
    initialized = true;

    const modal = document.getElementById('logout-confirm-modal');
    const noBtn = document.getElementById('logout-confirm-no');
    const yesBtn = document.getElementById('logout-confirm-yes');

    noBtn.addEventListener('click', closeLogoutModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLogoutModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLogoutModal();
    });

    yesBtn.addEventListener('click', async () => {
        if (running || !confirmHandler) return;

        running = true;
        const label = yesBtn.textContent;
        yesBtn.disabled = true;
        noBtn.disabled = true;
        yesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cerrando...';

        try {
            await confirmHandler();
        } finally {
            running = false;
            yesBtn.disabled = false;
            noBtn.disabled = false;
            yesBtn.textContent = label;
            closeLogoutModal();
        }
    });
}

// Abre la confirmación y ejecuta onConfirm solo si el usuario pulsa "Sí".
export function openLogoutModal(onConfirm) {
    initLogoutModal();

    const modal = document.getElementById('logout-confirm-modal');
    if (!modal) return;

    confirmHandler = onConfirm;
    modal.classList.add('active');
    lockScroll(true);

    const noBtn = document.getElementById('logout-confirm-no');
    if (noBtn) noBtn.focus();
}
