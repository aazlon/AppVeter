import { renderFooter } from './Layout.js';
import { API_BASE as API_ROOT, apiFetch } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    renderFooter();
    const API_BASE = `${API_ROOT}/users`;

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    const emailInput = document.getElementById('email');
    const step2Email = document.getElementById('step2Email');
    const step3Email = document.getElementById('step3Email');
    const resetCodeInput = document.getElementById('resetCode');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    const btnSendCode = document.getElementById('btnSendCode');
    const btnVerifyCode = document.getElementById('btnVerifyCode');
    const btnResetPassword = document.getElementById('btnResetPassword');

    const forgotError = document.getElementById('forgotError');
    const forgotSuccess = document.getElementById('forgotSuccess');
    const codeError = document.getElementById('codeError');
    const passwordError = document.getElementById('passwordError');

    const backToEmail = document.getElementById('backToEmail');
    const resendCodeLink = document.getElementById('resendCodeLink');

    let currentEmail = '';

    const setLoading = (button, isLoading) => {
        if (isLoading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    };

    const showStep = (step) => {
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'none';
        step.style.display = 'block';
    };

    const clearErrors = () => {
        forgotError.textContent = '';
        forgotSuccess.textContent = '';
        codeError.textContent = '';
        passwordError.textContent = '';
    };

    
    btnSendCode.addEventListener('click', async () => {
        clearErrors();

        const email = emailInput.value.trim();

        if (!email) {
            forgotError.textContent = 'Por favor ingresa tu correo electrónico';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            forgotError.textContent = 'Por favor ingresa un correo electrónico válido';
            return;
        }

        setLoading(btnSendCode, true);

        try {
            const response = await apiFetch(`${API_BASE}/forgot-password`, {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            if (result.success) {
                currentEmail = email;
                step2Email.textContent = email;
                step3Email.textContent = email;
                resetCodeInput.value = '';
                forgotSuccess.textContent = result.message;
                setTimeout(() => {
                    showStep(step2);
                }, 500);
            } else {
                forgotError.textContent = result.message || 'Error al enviar el código';
            }
        } catch (error) {
            console.error('Error:', error);
            forgotError.textContent = 'No se pudo conectar con el servidor';
        } finally {
            setLoading(btnSendCode, false);
        }
    });

    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnSendCode.click();
        }
    });

    
    btnVerifyCode.addEventListener('click', async () => {
        clearErrors();

        const code = resetCodeInput.value.trim();

        if (!code || code.length !== 8 || !/^\d{8}$/.test(code)) {
            codeError.textContent = 'Por favor ingresa un código válido de 8 dígitos';
            return;
        }

        setLoading(btnVerifyCode, true);

        try {
            const response = await apiFetch(`${API_BASE}/verify-reset-code`, {
                method: 'POST',
                body: JSON.stringify({ email: currentEmail, code })
            });

            const result = await response.json();

            if (result.success) {
                showStep(step3);
            } else {
                codeError.textContent = result.message || 'Código inválido';
            }
        } catch (error) {
            console.error('Error:', error);
            codeError.textContent = 'No se pudo conectar con el servidor';
        } finally {
            setLoading(btnVerifyCode, false);
        }
    });

    resetCodeInput.addEventListener('input', () => {
        resetCodeInput.value = resetCodeInput.value.replace(/\D/g, '');
    });

    resetCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnVerifyCode.click();
        }
    });

    
    btnResetPassword.addEventListener('click', async () => {
        clearErrors();

        const code = resetCodeInput.value.trim();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!newPassword || newPassword.length < 8) {
            passwordError.textContent = 'La contraseña debe tener al menos 8 caracteres';
            return;
        }

        if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            passwordError.textContent = 'La contraseña debe incluir mayúsculas, minúsculas y números';
            return;
        }

        if (newPassword !== confirmPassword) {
            passwordError.textContent = 'Las contraseñas no coinciden';
            return;
        }

        setLoading(btnResetPassword, true);

        try {
            const response = await apiFetch(`${API_BASE}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ email: currentEmail, code, password: newPassword })
            });

            const result = await response.json();

            if (result.success) {
                passwordError.style.color = '#27ae60';
                passwordError.textContent = 'Contraseña actualizada correctamente. Redirigiendo...';
                setTimeout(() => {
                    window.location.href = 'Login.html';
                }, 2000);
            } else {
                passwordError.textContent = result.message || 'Error al restablecer la contraseña';
            }
        } catch (error) {
            console.error('Error:', error);
            passwordError.textContent = 'No se pudo conectar con el servidor';
        } finally {
            setLoading(btnResetPassword, false);
        }
    });

    newPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmPasswordInput.focus();
        }
    });

    confirmPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnResetPassword.click();
        }
    });

    
    backToEmail.addEventListener('click', (e) => {
        e.preventDefault();
        clearErrors();
        resetCodeInput.value = '';
        showStep(step1);
    });

    
    resendCodeLink.addEventListener('click', async (e) => {
        e.preventDefault();
        clearErrors();

        if (!currentEmail) {
            showStep(step1);
            return;
        }

        setLoading(btnSendCode, true);

        try {
            const response = await apiFetch(`${API_BASE}/forgot-password`, {
                method: 'POST',
                body: JSON.stringify({ email: currentEmail })
            });

            const result = await response.json();

            if (result.success) {
                codeError.textContent = '';
                forgotSuccess.textContent = 'Código reenviado correctamente';
                setTimeout(() => {
                    forgotSuccess.textContent = '';
                }, 3000);
            } else {
                codeError.textContent = result.message || 'Error al reenviar el código';
            }
        } catch (error) {
            console.error('Error:', error);
            codeError.textContent = 'No se pudo conectar con el servidor';
        } finally {
            setLoading(btnSendCode, false);
        }
    });

    const btnNovedades = document.getElementById('btn-novedades');
    if (btnNovedades) {
        btnNovedades.addEventListener('click', () => {
            window.location.href = 'Novedad.html';
        });
    }

    const btnAcerca = document.getElementById('btn-acerca');
    if (btnAcerca) {
        btnAcerca.addEventListener('click', () => {
            window.location.href = 'About.html';
        });
    }
});
