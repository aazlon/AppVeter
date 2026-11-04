const User = require('../models/User');
const Rol = require('../models/Rol');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Keys = require('../config/Keys');
const bcrypt = require('bcrypt');
const { pool } = require('../config/Config');
const { sendResetCode } = require('../services/MailerService');
const { enqueueEmail } = require('../services/EmailQueue');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { imageToDataUrl } = require('../middleware/upload');
const { hasRole, extractTokens } = require('../middleware/auth');
const { revokeToken, revokeAllForUser } = require('../utils/tokenRevocation');
const logger = require('../utils/logger');

const MAX_RESET_ATTEMPTS = 5;

// El código de recuperación vence en 5 minutos, pero ESO SOLO DEBE LIMITAR
// ingresarlo. Una vez verificado se emite este token, que autoriza el cambio
// de contraseña durante un plazo más amplio: si no, el usuario que tarda
// unos minutos en elegir su nueva contraseña quedaría bloqueado aunque ya
// hubiera probado ser el dueño de la cuenta.
const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || '15m';

function signResetToken(email, code) {
    return jwt.sign(
        { purpose: 'password-reset', email, code },
        Keys.secretOrKey,
        { expiresIn: RESET_TOKEN_EXPIRES_IN }
    );
}

function validatePasswordStrength(password) {
    if (typeof password !== 'string' || password.length < 8) {
        return 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (password.length > 72) {
        return 'La contraseña no puede exceder 72 caracteres.';
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return 'La contraseña debe incluir mayúsculas, minúsculas y números.';
    }
    return null;
}

function cookieMaxAgeMs() {
    const raw = process.env.JWT_EXPIRES_IN || Keys.expiresIn || '8h';
    const match = /^(\d+)([smhd])$/i.exec(String(raw).trim());
    if (!match) return 8 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * multipliers[unit];
}

function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: cookieMaxAgeMs()
    };
}

function setSessionCookie(res, token) {
    res.cookie(Keys.cookieName, token, sessionCookieOptions());
}

function clearSessionCookie(res) {
    const { maxAge, ...options } = sessionCookieOptions();
    res.clearCookie(Keys.cookieName, options);
}

function sanitizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    const clean = { ...user };
    delete clean.password;
    delete clean.reset_code;
    delete clean.reset_code_expires;
    delete clean.reset_code_attempts;
    return clean;
}

function validateUserFields(user) {
    if (!user.name || !user.name.trim()) return 'El nombre es obligatorio.';
    if (!user.lastname || !user.lastname.trim()) return 'El apellido es obligatorio.';
    if (!user.email || !user.email.trim()) return 'El correo electrónico es obligatorio.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim())) return 'El correo electrónico no es válido.';
    if (!user.username || !user.username.trim()) return 'El nombre de usuario es obligatorio.';
    if (!user.cedula || !user.cedula.trim()) return 'La cédula es obligatoria.';
    if (!user.phone || !user.phone.trim()) return 'El teléfono es obligatorio.';
    if (!user.password) return 'La contraseña es obligatoria.';
    return validatePasswordStrength(user.password);
}

function handleDuplicateError(err) {
    if (err.code === 'ER_DUP_ENTRY') {
        const msg = err.message || '';
        
        // Log para debugging - ver el error real de MySQL
        logger.warn({ err: { code: err.code, message: msg, sql: err.sql } }, 'MySQL duplicate entry error');
        
        // Manejar diferentes formatos de errores de duplicado
        // Formato típico: "Duplicate entry 'valor' for key 'users.email'"
        // Formato alternativo: "Duplicate entry 'valor' for key 'users.email_unique'"
        
        const lowerMsg = msg.toLowerCase();
        
        // Verificar cada campo individualmente
        if (lowerMsg.includes('email') || lowerMsg.includes('correo')) return { field: 'email', message: 'El correo electrónico ya está registrado.' };
        if (lowerMsg.includes('username') || lowerMsg.includes('usuario')) return { field: 'username', message: 'El nombre de usuario ya está en uso.' };
        if (lowerMsg.includes('cedula') || lowerMsg.includes('cédula') || lowerMsg.includes('ci')) return { field: 'cedula', message: 'La cédula ya está registrada.' };
        if (lowerMsg.includes('phone') || lowerMsg.includes('teléfono') || lowerMsg.includes('telefono')) return { field: 'phone', message: 'El teléfono ya está registrado.' };
        
        // Si no se puede identificar el campo específico, devolver error general
        return { field: 'general', message: 'Ya existe un usuario con esos datos.' };
    }
    return null;
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, roles: user.roles || [] },
        Keys.secretOrKey,
        { expiresIn: Keys.expiresIn }
    );
}

function createUserWithRole(user, roleId) {
    return new Promise((resolve, reject) => {
        pool.getConnection(async (err, connection) => {
            if (err) return reject(err);
            try {
                await new Promise((res, rej) => connection.beginTransaction((e) => (e ? rej(e) : res())));
                const insertId = await new Promise((res, rej) => {
                    User.create(user, (e, id) => (e ? rej(e) : res(id)), connection);
                });
                await new Promise((res, rej) => {
                    Rol.create(insertId, roleId, (e, id) => (e ? rej(e) : res(id)), connection);
                });
                await new Promise((res, rej) => connection.commit((e) => (e ? rej(e) : res())));
                connection.release();
                resolve(insertId);
            } catch (e) {
                await new Promise((r) => connection.rollback(() => r()));
                connection.release();
                reject(e);
            }
        });
    });
}

module.exports = {

    async updateProfileWithImage(req, res) {
        try {
            const { id } = req.params;

            if (String(req.user.id) !== String(id) && !hasRole(req, 'ADMINISTRADOR')) {
                return res.status(403).json({ success: false, message: 'No tienes permisos para modificar este perfil' });
            }

            const user = JSON.parse(req.body.user);
            if (req.files && req.files.length > 0) {
                user.image = imageToDataUrl(req.files[0]);
            }

            User.update(id, user, (err) => {
                if (err) {
                    logger.error({ err }, 'Error actualizando perfil');
                    return res.status(500).json({ success: false, message: 'Hubo un error al actualizar el perfil' });
                }
                return res.status(200).json({ success: true, message: 'Perfil actualizado correctamente', data: user });
            });
        } catch (error) {
            logger.error({ err: error }, 'Error general actualizando perfil');
            return res.status(500).json({ success: false, message: 'Error general actualizando perfil' });
        }
    },

    async register(req, res) {
        const user = req.body;
        const validationError = validateUserFields(user);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        try {
            const data = await createUserWithRole(user, 3);
            return res.status(201).json({
                success: true,
                message: 'El usuario se registró correctamente',
                data
            });
        } catch (err) {
            const dupError = handleDuplicateError(err);
            if (dupError) {
                return res.status(400).json({ success: false, field: dupError.field, message: dupError.message });
            }
            logger.error({ err }, 'Error en registro de usuario');
            return res.status(500).json({ success: false, message: 'Hubo un error con el registro del usuario' });
        }
    },

    async registerWithImage(req, res) {
        try {
            const user = JSON.parse(req.body.user);
            const validationError = validateUserFields(user);
            if (validationError) {
                return res.status(400).json({ success: false, message: validationError });
            }

            if (req.files && req.files.length > 0) {
                user.image = imageToDataUrl(req.files[0]);
            }

            const userId = await createUserWithRole(user, 3);
            user.id = `${userId}`;
            const roleIds = await Rol.getRolesByUserId(userId);
            user.roles = roleIds.map((r) => ({ id: String(r.id), name: r.name }));
            delete user.password;

            return res.status(201).json({
                success: true,
                message: 'El usuario se registró correctamente',
                data: user
            });
        } catch (error) {
            const dupError = handleDuplicateError(error);
            if (dupError) {
                return res.status(400).json({ success: false, field: dupError.field, message: dupError.message });
            }
            logger.error({ err: error }, 'Error general registrando usuario');
            return res.status(500).json({ success: false, message: 'Error general registrando usuario' });
        }
    },

    getProfile(req, res) {
        const { id } = req.params;

        if (!req.user || (String(req.user.id) !== String(id) && !hasRole(req, 'ADMINISTRADOR'))) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para ver este perfil' });
        }

        User.findById(id, (err, user) => {
            if (err) {
                logger.error({ err }, 'Error al obtener el perfil');
                return res.status(500).json({ success: false, message: 'Error al obtener el perfil del usuario' });
            }
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            return res.status(200).json({ success: true, data: sanitizeUser(user) });
        });
    },

    forgotPassword(req, res) {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'El correo electrónico es requerido' });
        }

        const genericResponse = {
            success: true,
            message: 'Si existe una cuenta con ese correo, recibirás un código de recuperación'
        };

        User.findByEmail(email, (err, user) => {
            if (err) {
                logger.error({ err }, 'Error al verificar el correo');
                return res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
            }
            if (!user) {
                return res.status(200).json(genericResponse);
            }

            const code = crypto.randomInt(10000000, 100000000).toString();
            const expires = new Date(Date.now() + 5 * 60 * 1000);

            User.saveResetCode(email, code, expires, (errSave) => {
                if (errSave) {
                    logger.error({ err: errSave }, 'Error guardando código de recuperación');
                    return res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
                }

                enqueueEmail(() => sendResetCode(email, code))
                    .then(() => res.status(200).json(genericResponse))
                    .catch((emailError) => {
                        logger.error({ err: emailError }, 'Error encolando email');
                        return res.status(500).json({
                            success: false,
                            message: 'Error al enviar el correo electrónico. Verifica la configuración SMTP.'
                        });
                    });
            });
        });
    },

    verifyResetCode(req, res) {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'El correo y el código son requeridos' });
        }

        User.findByResetCode(email, String(code), (err, user) => {
            if (err) {
                logger.error({ err }, 'Error al verificar el código');
                return res.status(500).json({ success: false, message: 'Error al verificar el código' });
            }
            if (!user) {
                // Cada código erróneo consume un intento: sin esto el candado de
                // MAX_RESET_ATTEMPTS nunca se activaba (solo se incrementaba al acertar).
                User.incrementResetAttempts(email, (incErr) => {
                    if (incErr) {
                        logger.error({ err: incErr }, 'Error actualizando intentos de código');
                    }
                    return res.status(400).json({ success: false, message: 'Código inválido' });
                });
                return;
            }
            if (new Date() > new Date(user.reset_code_expires)) {
                User.invalidateResetCode(email, () => {});
                return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
            }
            if (Number(user.reset_code_attempts || 0) >= MAX_RESET_ATTEMPTS) {
                User.invalidateResetCode(email, () => {});
                return res.status(400).json({ success: false, message: 'Demasiados intentos. Solicita un código nuevo.' });
            }

            // El código ya superó su ventana de expiración y sus intentos: a
            // partir de aquí el plazo que importa es el del token de reset,
            // no el del código (que solo debe limitar ingresarlo).
            const resetToken = signResetToken(email, String(code));
            return res.status(200).json({
                success: true,
                message: 'Código verificado correctamente',
                resetToken
            });
        });
    },

    resetPassword(req, res) {
        const { email, code, password, resetToken } = req.body;

        if (!email || !password || (!code && !resetToken)) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }
        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        const finishReset = async (user) => {
            try {
                // Primero se invalidan todas las sesiones abiertas del usuario
                // (corte por iat) y después se cambia la contraseña: así no
                // puede quedar nunca una contraseña nueva con sesiones viejas
                // aún activas. Si el cambio de contraseña fallara después, el
                // usuario solo tendría que volver a iniciar sesión.
                try {
                    await revokeAllForUser(user.id);
                } catch (revErr) {
                    logger.error({ err: revErr }, 'Error revocando sesiones al restablecer la contraseña');
                    return res.status(500).json({
                        success: false,
                        message: 'No se pudieron cerrar las sesiones abiertas. Intenta de nuevo.'
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                User.updatePassword(user.id, hashedPassword, (errUpdate) => {
                    if (errUpdate) {
                        logger.error({ err: errUpdate }, 'Error actualizando contraseña');
                        return res.status(500).json({ success: false, message: 'Error al actualizar la contraseña' });
                    }
                    return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
                });
            } catch (error) {
                logger.error({ err: error }, 'Error en bcrypt');
                return res.status(500).json({ success: false, message: 'Error al procesar la nueva contraseña' });
            }
        };

        // Ruta principal (la usa la web): el usuario ya verificó el código en
        // /verify-reset-code y trae el token de restablecimiento. La expiración
        // de 5 minutos del código NO se vuelve a comprobar aquí: eso solo debe
        // limitar ingresarlo, no el tiempo que el usuario tarda en elegir su
        // nueva contraseña. El plazo que rige en este paso es el del token.
        if (resetToken) {
            let payload;
            try {
                payload = jwt.verify(String(resetToken), Keys.secretOrKey, { algorithms: ['HS256'] });
            } catch (tokenErr) {
                return res.status(400).json({
                    success: false,
                    resetTokenExpired: true,
                    message: 'El tiempo para completar el restablecimiento expiró. Solicita un código nuevo.'
                });
            }

            if (!payload || payload.purpose !== 'password-reset' || payload.email !== email || !payload.code) {
                return res.status(400).json({
                    success: false,
                    resetTokenExpired: true,
                    message: 'Sesión de restablecimiento inválida. Solicita un código nuevo.'
                });
            }

            // El token queda ligado al código vigente: si el usuario solicita
            // otro código (sobrescribe el actual) o ya usó este token (el cambio
            // de contraseña borra el código), deja de servir. Es de un solo uso.
            return User.findByResetCode(email, String(payload.code), (err, user) => {
                if (err) {
                    logger.error({ err }, 'Error al verificar el código');
                    return res.status(500).json({ success: false, message: 'Error al verificar el código' });
                }
                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'El código de restablecimiento ya no es válido. Solicita uno nuevo.'
                    });
                }
                return finishReset(user);
            });
        }

        // Ruta legacy (solo código, sin token): se conserva intacta por
        // compatibilidad con clientes/scripts que llaman este endpoint
        // directamente, p. ej. scripts/logout-revocation-check.js.
        User.findByResetCode(email, String(code), async (err, user) => {
            if (err) {
                logger.error({ err }, 'Error al verificar el código');
                return res.status(500).json({ success: false, message: 'Error al verificar el código' });
            }
            if (!user) {
                // También cuenta aquí: si no, llamar directamente a este endpoint
                // saltaba el candado de intentos de /verify-reset-code.
                User.incrementResetAttempts(email, (incErr) => {
                    if (incErr) {
                        logger.error({ err: incErr }, 'Error actualizando intentos de código');
                    }
                    return res.status(400).json({ success: false, message: 'Código inválido' });
                });
                return;
            }
            if (new Date() > new Date(user.reset_code_expires)) {
                User.invalidateResetCode(email, () => {});
                return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
            }
            if (Number(user.reset_code_attempts || 0) >= MAX_RESET_ATTEMPTS) {
                User.invalidateResetCode(email, () => {});
                return res.status(400).json({ success: false, message: 'Demasiados intentos. Solicita un código nuevo.' });
            }

            return finishReset(user);
        });
    },

    async registerReceptionist(req, res) {
        try {
            const user = JSON.parse(req.body.user);
            const validationError = validateUserFields(user);
            if (validationError) {
                return res.status(400).json({ success: false, message: validationError });
            }
            if (req.files && req.files.length > 0) {
                user.image = imageToDataUrl(req.files[0]);
            }

            const userId = await createUserWithRole(user, 2);
            user.id = `${userId}`;
            delete user.password;
            return res.status(201).json({ success: true, message: 'Recepcionista registrado correctamente', data: user });
        } catch (error) {
            const dupError = handleDuplicateError(error);
            if (dupError) {
                return res.status(400).json({ success: false, field: dupError.field, message: dupError.message });
            }
            logger.error({ err: error }, 'Error registrando recepcionista');
            return res.status(500).json({ success: false, message: 'Error general registrando recepcionista' });
        }
    },

    async registerVeterinarian(req, res) {
        try {
            const user = JSON.parse(req.body.user);
            const validationError = validateUserFields(user);
            if (validationError) {
                return res.status(400).json({ success: false, message: validationError });
            }
            if (req.files && req.files.length > 0) {
                user.image = imageToDataUrl(req.files[0]);
            }

            const userId = await createUserWithRole(user, 4);
            user.id = `${userId}`;
            delete user.password;
            return res.status(201).json({ success: true, message: 'Veterinario registrado correctamente', data: user });
        } catch (error) {
            const dupError = handleDuplicateError(error);
            if (dupError) {
                return res.status(400).json({ success: false, field: dupError.field, message: dupError.message });
            }
            logger.error({ err: error }, 'Error registrando veterinario');
            return res.status(500).json({ success: false, message: 'Error general registrando veterinario' });
        }
    },

    getReceptionists(req, res) {
        const pagination = parsePagination(req.query, { defaultLimit: 50 });
        User.getAllByRole(2, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener recepcionistas');
                return res.status(500).json({ success: false, message: 'Error al obtener los recepcionistas' });
            }
            return res.status(200).json({
                success: true,
                data: result.rows,
                pagination: buildPagination(result.total, pagination.page, pagination.limit)
            });
        });
    },

    getVeterinarians(req, res) {
        const pagination = parsePagination(req.query, { defaultLimit: 50 });
        User.getAllByRole(4, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener veterinarios');
                return res.status(500).json({ success: false, message: 'Error al obtener los veterinarios' });
            }
            return res.status(200).json({
                success: true,
                data: result.rows,
                pagination: buildPagination(result.total, pagination.page, pagination.limit)
            });
        });
    },

    deleteUser(req, res) {
        const { id } = req.params;
        User.delete(id, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al eliminar el usuario');
                return res.status(500).json({ success: false, message: 'Error al eliminar el usuario' });
            }
            if (data.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
            return res.status(200).json({ success: true, message: 'Usuario eliminado correctamente' });
        });
    },

    login(req, res) {
        const identifier = req.body.username_or_email;
        const password = req.body.password;
        const invalidCredentials = { success: false, message: 'Credenciales incorrectas' };

        User.findByUsernameOrEmail(identifier, async (err, myUser) => {
            if (err) {
                logger.error({ err }, 'Error en autenticación');
                return res.status(500).json({ success: false, message: 'Hubo un error con la autenticación del usuario' });
            }
            if (!myUser) {
                return res.status(401).json(invalidCredentials);
            }

            try {
                const isPasswordValid = await bcrypt.compare(password, myUser.password);

                if (!isPasswordValid) {
                    return res.status(401).json(invalidCredentials);
                }

                const roleIds = myUser.roles.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
                const token = signToken({ id: myUser.id, email: myUser.email, roles: roleIds });
                setSessionCookie(res, token);

                const data = {
                    id: myUser.id,
                    name: myUser.name,
                    lastname: myUser.lastname,
                    email: myUser.email,
                    username: myUser.username,
                    phone: myUser.phone,
                    cedula: myUser.cedula,
                    image: myUser.image,
                    roles: myUser.roles
                };

                return res.status(200).json({
                    success: true,
                    message: 'El usuario se autenticó correctamente',
                    data: {
                        ...data,
                        session_token: token
                    }
                });
            } catch (error) {
                logger.error({ err: error }, 'Error procesando la autenticación');
                return res.status(500).json({ success: false, message: 'Error procesando la autenticación' });
            }
        });
    },

    async logout(req, res) {
        // Revoca en servidor cada copia del token presente en la petición
        // (cookie de sesión y cabecera Authorization): el JWT emitido deja de
        // ser aceptado en authenticate(), sin afectar a otras sesiones abiertas.
        try {
            const tokens = [...new Set(extractTokens(req))];
            for (const token of tokens) {
                await revokeToken(token);
            }
        } catch (err) {
            logger.error({ err }, 'Error al revocar el token en el logout');
            return res.status(500).json({ success: false, message: 'No se pudo cerrar la sesión' });
        }
        clearSessionCookie(res);
        return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente' });
    }
};
