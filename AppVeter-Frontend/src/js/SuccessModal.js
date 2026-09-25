export function showSuccessModal(message, redirectUrl) {
    const modal = document.getElementById('successModal');
    const messageEl = document.getElementById('successModalMessage');

    if (messageEl) {
        messageEl.textContent = message;
    }

    if (!modal) {
        if (redirectUrl) window.location.href = redirectUrl;
        return;
    }

    modal.classList.remove('hide');
    modal.classList.add('active');

    setTimeout(() => {
        modal.classList.add('hide');
        setTimeout(() => {
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                modal.classList.remove('active');
                modal.classList.remove('hide');
            }
        }, 400);
    }, 2000);
}