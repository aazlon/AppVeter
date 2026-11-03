const Service = require('../models/Service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { uploadUrl } = require('../utils/urls');
const logger = require('../utils/logger');

module.exports = {
    create(req, res) {
        const data = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            image: req.body.image || null,
            user_id: req.body.user_id
        };

        if (!data.titulo || !data.descripcion || !data.user_id) {
            return res.status(400).json({
                success: false,
                message: 'Los campos titulo, descripcion y user_id son requeridos'
            });
        }

        Service.create(data, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al crear el servicio');
                return res.status(500).json({ success: false, message: 'Error al crear el servicio' });
            }
            return res.status(201).json({ success: true, message: 'Servicio creado correctamente', data: result });
        });
    },

    createWithImage(req, res) {
        try {
            const data = {
                titulo: req.body.titulo,
                descripcion: req.body.descripcion,
                image: null,
                user_id: req.body.user_id
            };

            if (!data.titulo || !data.descripcion || !data.user_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Los campos titulo, descripcion y user_id son requeridos'
                });
            }

            if (req.files && req.files.length > 0) {
                data.image = uploadUrl(req.files[0].filename);
            }

            Service.create(data, (err, result) => {
                if (err) {
                    logger.error({ err }, 'Error al crear el servicio');
                    return res.status(500).json({ success: false, message: 'Error al crear el servicio' });
                }
                return res.status(201).json({ success: true, message: 'Servicio creado correctamente', data: result });
            });
        } catch (error) {
            logger.error({ err: error }, 'Error general creando servicio');
            return res.status(500).json({ success: false, message: 'Error general creando servicio' });
        }
    },

    getAll(req, res) {
        const pagination = parsePagination(req.query, { defaultLimit: 24 });
        Service.getAll(pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener los servicios');
                return res.status(500).json({ success: false, message: 'Error al obtener los servicios' });
            }
            return res.status(200).json({
                success: true,
                data: result.rows,
                pagination: buildPagination(result.total, pagination.page, pagination.limit)
            });
        });
    },

    getById(req, res) {
        const { id } = req.params;
        Service.getById(id, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al obtener el servicio');
                return res.status(500).json({ success: false, message: 'Error al obtener el servicio' });
            }
            if (!data) {
                return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
            }
            return res.status(200).json({ success: true, data });
        });
    },

    update(req, res) {
        const { id } = req.params;
        const data = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            image: req.body.image || null
        };

        if (!data.titulo || !data.descripcion) {
            return res.status(400).json({ success: false, message: 'Los campos titulo y descripcion son requeridos' });
        }

        Service.update(id, data, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al actualizar el servicio');
                return res.status(500).json({ success: false, message: 'Error al actualizar el servicio' });
            }
            if (!result) {
                return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
            }
            return res.status(200).json({ success: true, message: 'Servicio actualizado correctamente', data: result });
        });
    },

    updateWithImage(req, res) {
        try {
            const { id } = req.params;
            const data = {
                titulo: req.body.titulo,
                descripcion: req.body.descripcion,
                image: null
            };

            if (!data.titulo || !data.descripcion) {
                return res.status(400).json({ success: false, message: 'Los campos titulo y descripcion son requeridos' });
            }

            if (req.files && req.files.length > 0) {
                data.image = uploadUrl(req.files[0].filename);
            }

            Service.update(id, data, (err, result) => {
                if (err) {
                    logger.error({ err }, 'Error al actualizar el servicio');
                    return res.status(500).json({ success: false, message: 'Error al actualizar el servicio' });
                }
                if (!result) {
                    return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
                }
                return res.status(200).json({ success: true, message: 'Servicio actualizado correctamente', data: result });
            });
        } catch (error) {
            logger.error({ err: error }, 'Error general actualizando servicio');
            return res.status(500).json({ success: false, message: 'Error general actualizando servicio' });
        }
    },

    delete(req, res) {
        const { id } = req.params;
        Service.delete(id, (err, success) => {
            if (err) {
                logger.error({ err }, 'Error al eliminar el servicio');
                return res.status(500).json({ success: false, message: 'Error al eliminar el servicio' });
            }
            if (!success) {
                return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
            }
            return res.status(200).json({ success: true, message: 'Servicio eliminado correctamente' });
        });
    }
};
