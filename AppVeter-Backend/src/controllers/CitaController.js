const Cita = require('../models/Cita');
const Notificacion = require('../models/Notificacion');
const { pool } = require('../config/Config');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { hasRole } = require('../middleware/auth');
const Notifier = require('../services/Notifier');
const logger = require('../utils/logger');

const CitaController = {};

function formatDateStr(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${parseInt(day)} de ${meses[parseInt(month) - 1]} de ${year}`;
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
        const cita = req.body;
        if (!hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA')) {
            cita.user_id = req.user.id;
        } else if (!cita.user_id) {
            cita.user_id = req.user.id;
        }

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

        if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado no válido. Debe ser APROBADA o RECHAZADA' });
        }
        if (estado === 'APROBADA' && !fecha_cita) {
            return res.status(400).json({ success: false, message: 'Debe proporcionar una fecha para la cita' });
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

        if (!fecha_cita) {
            return res.status(400).json({ success: false, message: 'Debe proporcionar una fecha para la cita' });
        }

        Cita.updateDate(id, fecha_cita, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al actualizar la fecha de la cita');
                return res.status(500).json({ success: false, message: 'Error al actualizar la fecha de la cita' });
            }
            res.status(200).json({
                success: true,
                message: 'Fecha de la cita actualizada exitosamente',
                data: result
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
