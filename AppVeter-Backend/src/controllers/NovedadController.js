const Novedad = require('../models/Novedad');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { uploadUrl } = require('../utils/urls');
const logger = require('../utils/logger');

module.exports = {
    create(req, res) {
        const data = {
            descripcion: req.body.descripcion,
            image: req.body.image || null,
            user_id: req.body.user_id
        };

        if (!data.descripcion || !data.user_id) {
            return res.status(400).json({
                success: false,
                message: 'Los campos descripcion y user_id son requeridos'
            });
        }

        Novedad.create(data, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al crear la novedad');
                return res.status(500).json({ success: false, message: 'Error al crear la novedad' });
            }
            return res.status(201).json({ success: true, message: 'Novedad creada correctamente', data: result });
        });
    },

    createWithImage(req, res) {
        try {
            const data = {
                descripcion: req.body.descripcion,
                image: null,
                user_id: req.body.user_id
            };

            if (!data.descripcion || !data.user_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Los campos descripcion y user_id son requeridos'
                });
            }

            if (req.files && req.files.length > 0) {
                data.image = uploadUrl(req.files[0].filename);
            }

            Novedad.create(data, (err, result) => {
                if (err) {
                    logger.error({ err }, 'Error al crear la novedad');
                    return res.status(500).json({ success: false, message: 'Error al crear la novedad' });
                }
                return res.status(201).json({ success: true, message: 'Novedad creada correctamente', data: result });
            });
        } catch (error) {
            logger.error({ err: error }, 'Error general creando novedad');
            return res.status(500).json({ success: false, message: 'Error general creando novedad' });
        }
    },

    getAll(req, res) {
        const pagination = parsePagination(req.query, { defaultLimit: 24 });
        Novedad.getAll(pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al obtener las novedades');
                return res.status(500).json({ success: false, message: 'Error al obtener las novedades' });
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
        Novedad.getById(id, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al obtener la novedad');
                return res.status(500).json({ success: false, message: 'Error al obtener la novedad' });
            }
            if (!data) {
                return res.status(404).json({ success: false, message: 'Novedad no encontrada' });
            }
            return res.status(200).json({ success: true, data });
        });
    },

    update(req, res) {
        const { id } = req.params;
        const data = {
            descripcion: req.body.descripcion,
            image: req.body.image || null
        };

        if (!data.descripcion) {
            return res.status(400).json({ success: false, message: 'El campo descripcion es requerido' });
        }

        Novedad.update(id, data, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al actualizar la novedad');
                return res.status(500).json({ success: false, message: 'Error al actualizar la novedad' });
            }
            if (!result) {
                return res.status(404).json({ success: false, message: 'Novedad no encontrada' });
            }
            return res.status(200).json({ success: true, message: 'Novedad actualizada correctamente', data: result });
        });
    },

    updateWithImage(req, res) {
        try {
            const { id } = req.params;
            const data = {
                descripcion: req.body.descripcion,
                image: null
            };

            if (!data.descripcion) {
                return res.status(400).json({ success: false, message: 'El campo descripcion es requerido' });
            }

            if (req.files && req.files.length > 0) {
                data.image = uploadUrl(req.files[0].filename);
            }

            Novedad.update(id, data, (err, result) => {
                if (err) {
                    logger.error({ err }, 'Error al actualizar la novedad');
                    return res.status(500).json({ success: false, message: 'Error al actualizar la novedad' });
                }
                if (!result) {
                    return res.status(404).json({ success: false, message: 'Novedad no encontrada' });
                }
                return res.status(200).json({ success: true, message: 'Novedad actualizada correctamente', data: result });
            });
        } catch (error) {
            logger.error({ err: error }, 'Error general actualizando novedad');
            return res.status(500).json({ success: false, message: 'Error general actualizando novedad' });
        }
    },

    delete(req, res) {
        const { id } = req.params;
        Novedad.delete(id, (err, success) => {
            if (err) {
                logger.error({ err }, 'Error al eliminar la novedad');
                return res.status(500).json({ success: false, message: 'Error al eliminar la novedad' });
            }
            if (!success) {
                return res.status(404).json({ success: false, message: 'Novedad no encontrada' });
            }
            return res.status(200).json({ success: true, message: 'Novedad eliminada correctamente' });
        });
    }
};
