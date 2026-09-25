const ROLE_IDS = {
    ADMINISTRADOR: 1,
    RECEPCIONISTA: 2,
    CLIENTE: 3,
    VETERINARIO: 4
};

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
        console.warn('Sesión inválida en localStorage:', error);
        return null;
    }
}

export function hasRole(user, name, id) {
    if (!user || !user.roles) return false;
    const roleId = id !== undefined ? id : ROLE_IDS[name];
    return user.roles.some(r => r.name === name || (roleId !== undefined && r.id == roleId));
}

export function getRoleFlags(user = getSession()) {
    return {
        user,
        isAdmin: hasRole(user, 'ADMINISTRADOR'),
        isRecepcionista: hasRole(user, 'RECEPCIONISTA'),
        isCliente: hasRole(user, 'CLIENTE'),
        isVeterinario: hasRole(user, 'VETERINARIO')
    };
}

export function requireAuth(redirect = './Login.html') {
    const user = getSession();
    if (!user) {
        console.warn('No se encontró sesión activa. Redirigiendo...');
        window.location.href = redirect;
        return null;
    }
    return user;
}
