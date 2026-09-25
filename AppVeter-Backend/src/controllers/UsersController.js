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
const { uploadUrl } = require('../utils/urls');
const { hasRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const MAX_RESET_ATTEMPTS = 5;

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
        if (msg.includes('users.email')) return { field: 'email', message: 'El correo electrónico ya está registrado.' };
        if (msg.includes('users.username')) return { field: 'username', message: 'El nombre de usuario ya está en uso.' };
        if (msg.includes('users.cedula')) return { field: 'cedula', message: 'La cédula ya está registrada.' };
        if (msg.includes('users.phone')) return { field: 'phone', message: 'El teléfono ya está registrado.' };
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
                user.image = uploadUrl(req.files[0].filename);
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
                user.image = uploadUrl(req.files[0].filename);
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

            return res.status(200).json({ success: true, message: 'Código verificado correctamente' });
        });
    },

    resetPassword(req, res) {
        const { email, code, password } = req.body;

        if (!email || !code || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
        }
        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

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

            try {
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
                user.image = uploadUrl(req.files[0].filename);
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
                user.image = uploadUrl(req.files[0].filename);
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

    logout(req, res) {
        clearSessionCookie(res);
        return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente' });
    }
};
