const Notificacion = require('../models/Notificacion');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { hasRole } = require('../middleware/auth');
const Notifier = require('../services/Notifier');
const logger = require('../utils/logger');

const NotificacionController = {};

NotificacionController.createNotificacion = async (req, res) => {
    try {
        if (!hasRole(req, 'ADMINISTRADOR', 'RECEPCIONISTA', 'VETERINARIO')) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para crear notificaciones' });
        }
        const notificacion = req.body;
        if (!notificacion.user_id) {
            return res.status(400).json({ success: false, message: 'El usuario destinatario es requerido' });
        }
        notificacion.emisor_id = req.user.id;
        Notificacion.create(notificacion, (err, notifId) => {
            if (err) {
                logger.error({ err }, 'Error al crear la notificación');
                return res.status(500).json({ success: false, message: 'Error al crear la notificación' });
            }
            Notifier.notify(notificacion.user_id, { type: 'notificacion:nueva', id: notifId });
            res.status(201).json({
                success: true,
                message: 'Notificación creada exitosamente',
                data: { id: notifId }
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.getNotificacionesByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!hasRole(req, 'ADMINISTRADOR') && String(userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para ver estas notificaciones' });
        }

        const pagination = parsePagination(req.query, { defaultLimit: 20 });
        Notificacion.getByUserId(userId, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener las notificaciones');
                return res.status(500).json({ success: false, message: 'Error al obtener las notificaciones' });
            }
            res.status(200).json({
                success: true,
                data: result.rows,
                pagination: buildPagination(result.total, pagination.page, pagination.limit)
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.markNotificacionAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        Notificacion.getById(id, (err, notif) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la notificación');
                return res.status(500).json({ success: false, message: 'Error al marcar la notificación como leída' });
            }
            if (!notif) {
                return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
            }
            if (!hasRole(req, 'ADMINISTRADOR') && String(notif.user_id) !== String(req.user.id)) {
                return res.status(403).json({ success: false, message: 'No tienes permisos sobre esta notificación' });
            }

            Notificacion.markAsRead(id, (err2) => {
                if (err2) {
                    logger.error({ err: err2 }, 'Error al marcar la notificación como leída');
                    return res.status(500).json({ success: false, message: 'Error al marcar la notificación como leída' });
                }
                res.status(200).json({ success: true, message: 'Notificación marcada como leída' });
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!hasRole(req, 'ADMINISTRADOR') && String(userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'No tienes permisos sobre estas notificaciones' });
        }

        Notificacion.markAllAsRead(userId, (err) => {
            if (err) {
                logger.error({ err }, 'Error al marcar notificaciones como leídas');
                return res.status(500).json({ success: false, message: 'Error al marcar todas las notificaciones como leídas' });
            }
            res.status(200).json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.deleteNotificacion = async (req, res) => {
    try {
        const { id } = req.params;

        Notificacion.getById(id, (err, notif) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la notificación');
                return res.status(500).json({ success: false, message: 'Error al eliminar la notificación' });
            }
            if (!notif) {
                return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
            }
            if (!hasRole(req, 'ADMINISTRADOR') && String(notif.user_id) !== String(req.user.id)) {
                return res.status(403).json({ success: false, message: 'No tienes permisos sobre esta notificación' });
            }

            Notificacion.delete(id, (err2, result) => {
                if (err2) {
                    logger.error({ err: err2 }, 'Error al eliminar la notificación');
                    return res.status(500).json({ success: false, message: 'Error al eliminar la notificación' });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
                }
                res.status(200).json({ success: true, message: 'Notificación eliminada exitosamente' });
            });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.getUnreadCount = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!hasRole(req, 'ADMINISTRADOR') && String(userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'No tienes permisos sobre estas notificaciones' });
        }

        Notificacion.getUnreadCount(userId, (err, count) => {
            if (err) {
                logger.error({ err }, 'Error al obtener contador de no leídas');
                return res.status(500).json({ success: false, message: 'Error al obtener el contador de notificaciones no leídas' });
            }
            res.status(200).json({ success: true, data: { count } });
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en el servidor');
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

NotificacionController.stream = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', user_id: req.user.id })}\n\n`);
    Notifier.subscribe(req.user.id, res);

    const heartbeat = setInterval(() => {
        res.write(`: ping\n\n`);
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
    });
};

module.exports = NotificacionController;
