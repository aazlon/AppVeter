const Cita = require('../models/Cita');
const Notificacion = require('../models/Notificacion');
const { pool } = require('../config/Config');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { hasRole } = require('../middleware/auth');
const Notifier = require('../services/Notifier');
const logger = require('../utils/logger');
const {
    isNonEmptyString,
    isValidEmail,
    isValidId,
    isValidDateOnly,
    isTodayOrFutureDate
} = require('../utils/validators');

const CitaController = {};

function formatDateStr(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${parseInt(day)} de ${meses[parseInt(month) - 1]} de ${year}`;
}

// Valida la fecha de la cita ANTES de tocar la base de datos:
// formato 'YYYY-MM-DD' válido y no anterior a hoy (misma regla que aplica la
// interfaz con <input min="hoy">). Devuelve el mensaje de error o null.
function validateFechaCita(fecha_cita) {
    if (!isValidDateOnly(fecha_cita)) {
        return 'La fecha de la cita debe tener un formato válido (AAAA-MM-DD)';
    }
    if (!isTodayOrFutureDate(fecha_cita)) {
        return 'La fecha de la cita no puede ser anterior a hoy';
    }
    return null;
}

function paginatedResponse(res, result, pagination) {
    res.status(200).json({
        success: true,
        data: result.rows,
        pagination: buildPagination(result.total, pagination.page, pagination.limit)
    });
}

CitaController.createCita = async (req, res) => {
    try {
        const cita = req.body || {};

        // Validación de campos obligatorios y formatos ANTES de acceder a la
        // base de datos: así una entrada incompleta o inválida responde 400
        // controlado y no un 500 proveniente de los límites de la BD.
        const camposRequeridos = {
            nombre_propietario: 'el nombre del propietario',
            ci: 'el C.I.',
            telefono: 'el teléfono',
            direccion: 'la dirección',
            correo_electronico: 'el correo electrónico',
            motivo_cita: 'el motivo de la cita'
        };
        const faltantes = Object.entries(camposRequeridos)
            .filter(([campo]) => !isNonEmptyString(cita[campo], campo === 'motivo_cita' || campo === 'direccion' ? 65535 : 255))
            .map(([, etiqueta]) => etiqueta);

        if (faltantes.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Faltan datos requeridos: ${faltantes.join(', ')}`
            });
        }
        if (!isValidEmail(cita.correo_electronico)) {
            return res.status(400).json({ success: false, message: 'El correo electrónico no tiene un formato válido' });
        }

        if (!hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA')) {
            // El cliente no puede suplantar a otro usuario: su identidad se toma
            // de la sesión, nunca del payload.
            cita.user_id = req.user.id;
        } else if (!cita.user_id) {
            cita.user_id = req.user.id;
        } else if (!isValidId(cita.user_id)) {
            return res.status(400).json({ success: false, message: 'El usuario asignado a la cita no es válido' });
        }

        // Regla de negocio: toda cita nueva nace PENDIENTE; el estado no lo
        // decide el cliente sino la recepción/administración al aprobarla.
        cita.estado = 'PENDIENTE';
        // La fecha de solicitud la fija el servidor: es un dato de auditoría,
        // no un campo que el cliente deba enviar (evita el NOT NULL de la BD
        // y que un cliente manipule la fecha registrada).
        cita.fecha_solicitud = new Date();

        pool.getConnection(async (err, connection) => {
            if (err) {
                logger.error({ err }, 'Error obteniendo conexión para crear cita');
                return res.status(500).json({ success: false, message: 'Error al crear la cita' });
            }

            try {
                await new Promise((res, rej) => connection.beginTransaction((e) => (e ? rej(e) : res())));

                const citaId = await new Promise((resolve, reject) => {
                    Cita.create(cita, (e, id) => (e ? reject(e) : resolve(id)), connection);
                });

                const nombreUsuario = cita.nombre_propietario || 'Un cliente';
                const titulo = 'Nueva Solicitud de Cita';
                const mensaje = `El usuario ${nombreUsuario} te ha enviado una nueva solicitud de cita veterinaria`;

                const recepcionistas = await Cita.getRecepcionistas(connection);
                if (recepcionistas.length > 0) {
                    await Notificacion.createMany(
                        recepcionistas.map((rec) => ({
                            user_id: rec.id,
                            titulo,
                            mensaje,
                            tipo: 'CITA',
                            cita_id: citaId,
                            emisor_id: cita.user_id || null
                        })),
                        connection
                    );
                }

                await new Promise((res, rej) => connection.commit((e) => (e ? rej(e) : res())));
                connection.release();

                if (recepcionistas.length > 0) {
                    for (const rec of recepcionistas) {
                        Notifier.notify(rec.id, { type: 'notificacion:nueva', cita_id: citaId });
                    }
                }

                res.status(201).json({
                    success: true,
                    message: 'Cita creada exitosamente',
                    data: { id: citaId }
                });
            } catch (e) {
                await new Promise((r) => connection.rollback(() => r()));
                connection.release();
                logger.error({ err: e }, 'Error al crear la cita');
                res.status(500).json({ success: false, message: 'Error al crear la cita' });
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.getAllCitas = async (req, res) => {
    try {
        const pagination = parsePagination(req.query, { defaultLimit: 20 });
        const filters = { estado: req.query.estado || '' };
        Cita.getAll(filters, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener las citas');
                return res.status(500).json({ success: false, message: 'Error al obtener las citas' });
            }
            paginatedResponse(res, result, pagination);
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.getCitaById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: 'El identificador de la cita no es válido' });
        }
        Cita.getById(id, (err, cita) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la cita');
                return res.status(500).json({ success: false, message: 'Error al obtener la cita' });
            }
            if (!cita) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }
            if (!hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA') && String(cita.user_id) !== String(req.user.id)) {
                return res.status(403).json({ success: false, message: 'No tienes permisos para ver esta cita' });
            }
            res.status(200).json({ success: true, data: cita });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.updateCitaStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, fecha_cita, emisor_id } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: 'El identificador de la cita no es válido' });
        }
        if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado no válido. Debe ser APROBADA o RECHAZADA' });
        }
        if (estado === 'APROBADA' && !fecha_cita) {
            return res.status(400).json({ success: false, message: 'Debe proporcionar una fecha para la cita' });
        }
        // La fecha (cuando se envía) se valida de forma estricta antes de la BD.
        if (fecha_cita) {
            const errorFecha = validateFechaCita(fecha_cita);
            if (errorFecha) {
                return res.status(400).json({ success: false, message: errorFecha });
            }
        }

        Cita.getById(id, async (err, cita) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la cita');
                return res.status(500).json({ success: false, message: 'Error al obtener la cita' });
            }
            if (!cita) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }

            pool.getConnection(async (connErr, connection) => {
                if (connErr) {
                    logger.error({ err: connErr }, 'Error de conexión');
                    return res.status(500).json({ success: false, message: 'Error al actualizar la cita' });
                }

                try {
                    await new Promise((res, rej) => connection.beginTransaction((e) => (e ? rej(e) : res())));

                    await new Promise((resolve, reject) => {
                        Cita.updateStatus(id, estado, fecha_cita, (e) => (e ? reject(e) : resolve()), connection);
                    });

                    const titulo = estado === 'APROBADA' ? 'Cita Aprobada' : 'Cita Rechazada';
                    const fechaFormateada = formatDateStr(fecha_cita);
                    const mensaje = estado === 'APROBADA'
                        ? `Tu solicitud de cita veterinaria ha sido aprobada para el día ${fechaFormateada}`
                        : `Tu solicitud de cita veterinaria ha sido rechazada`;

                    await new Promise((resolve, reject) => {
                        Notificacion.create({
                            user_id: cita.user_id,
                            titulo,
                            mensaje,
                            tipo: 'CITA',
                            cita_id: cita.id,
                            emisor_id: emisor_id || null
                        }, (e) => (e ? reject(e) : resolve()), connection);
                    });

                    await new Promise((res, rej) => connection.commit((e) => (e ? rej(e) : res())));
                    connection.release();

                    Notifier.notify(cita.user_id, { type: 'notificacion:nueva', cita_id: cita.id });

                    res.status(200).json({
                        success: true,
                        message: `Cita ${estado.toLowerCase()} exitosamente`
                    });
                } catch (e) {
                    await new Promise((r) => connection.rollback(() => r()));
                    connection.release();
                    logger.error({ err: e }, 'Error al actualizar la cita');
                    res.status(500).json({ success: false, message: 'Error al actualizar la cita' });
                }
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.getCitasByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidId(userId)) {
            return res.status(400).json({ success: false, message: 'El identificador de usuario no es válido' });
        }
        if (!hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA') && String(userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para ver estas citas' });
        }

        const pagination = parsePagination(req.query, { defaultLimit: 20 });
        Cita.getByUserId(userId, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener las citas del usuario');
                return res.status(500).json({ success: false, message: 'Error al obtener las citas del usuario' });
            }
            paginatedResponse(res, result, pagination);
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.updateCitaDate = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_cita } = req.body;

        if (!isValidId(id)) {
            return res.status(400).json({ success: false, message: 'El identificador de la cita no es válido' });
        }
        if (!fecha_cita) {
            return res.status(400).json({ success: false, message: 'Debe proporcionar una fecha para la cita' });
        }
        const errorFecha = validateFechaCita(fecha_cita);
        if (errorFecha) {
            return res.status(400).json({ success: false, message: errorFecha });
        }

        // Comprobar existencia antes de actualizar: si no hay cita, se responde
        // 404 controlado en vez de un 200 engañoso (la tabla no informa).
        Cita.getById(id, (err, cita) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la cita');
                return res.status(500).json({ success: false, message: 'Error al actualizar la fecha de la cita' });
            }
            if (!cita) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }

            Cita.updateDate(id, fecha_cita, (updateErr, result) => {
                if (updateErr) {
                    logger.error({ err: updateErr }, 'Error al actualizar la fecha de la cita');
                    return res.status(500).json({ success: false, message: 'Error al actualizar la fecha de la cita' });
                }
                res.status(200).json({
                    success: true,
                    message: 'Fecha de la cita actualizada exitosamente',
                    data: result
                });
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

CitaController.getAllPending = async (req, res) => {
    try {
        const pagination = parsePagination(req.query, { defaultLimit: 20 });
        Cita.getAllPending(pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener las citas pendientes');
                return res.status(500).json({ success: false, message: 'Error al obtener las citas pendientes' });
            }
            paginatedResponse(res, result, pagination);
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

module.exports = CitaController;
