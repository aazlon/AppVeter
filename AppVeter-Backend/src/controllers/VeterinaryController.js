const Veterinary = require('../models/Veterinary');
const { parsePagination, buildPagination } = require('../utils/pagination');
const logger = require('../utils/logger');

module.exports = {

    getDoctors(req, res) {
        Veterinary.getAllDoctors((err, data) => {
            if (err) {
                logger.error({ err }, 'Error al obtener doctores');
                return res.status(500).json({ success: false, message: 'Hubo un error al obtener la lista de doctores' });
            }
            return res.status(200).json({ success: true, data });
        });
    },

    registerHistory(req, res) {
        const historyData = req.body;

        if (!historyData.client || !historyData.client.nombre_propietario || !historyData.client.ci || !historyData.client.telefono) {
            return res.status(400).json({
                success: false,
                message: 'Los datos del cliente (nombre, C.I., teléfono) son requeridos'
            });
        }
        if (!historyData.pet || !historyData.pet.nombre_mascota || !historyData.pet.especie || !historyData.pet.raza) {
            return res.status(400).json({
                success: false,
                message: 'Los datos de la mascota (nombre, especie, raza) son requeridos'
            });
        }

        Veterinary.create(historyData, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al registrar la historia clínica');
                return res.status(500).json({ success: false, message: 'Hubo un error al registrar la historia clínica' });
            }
            return res.status(201).json({
                success: true,
                message: 'La historia clínica se registró correctamente',
                data
            });
        });
    },

    getHistories(req, res) {
        const filters = {
            search: req.query.search || '',
            especie: req.query.especie || '',
            doctor_nombre: req.query.doctor_nombre || '',
            fecha_inicio: req.query.fecha_inicio || '',
            fecha_fin: req.query.fecha_fin || ''
        };

        const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

        Veterinary.getAll(filters, pagination, (err, result) => {
            if (err) {
                logger.error({ err }, 'Error al consultar las historias clínicas');
                return res.status(500).json({ success: false, message: 'Hubo un error al consultar las historias clínicas' });
            }
            return res.status(200).json({
                success: true,
                data: result.rows,
                pagination: buildPagination(result.total, pagination.page, pagination.limit)
            });
        });
    },

    updateHistory(req, res) {
        const mascotaId = req.params.id;
        const historyData = req.body;

        if (!mascotaId) {
            return res.status(400).json({ success: false, message: 'El ID de la mascota es necesario para actualizar' });
        }

        Veterinary.update(mascotaId, historyData, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al actualizar la historia clínica');
                return res.status(500).json({ success: false, message: 'Hubo un error al actualizar la historia clínica' });
            }
            return res.status(200).json({
                success: true,
                message: 'La historia clínica se modificó exitosamente',
                data
            });
        });
    },

    deleteHistory(req, res) {
        const mascotaId = req.params.id;

        if (!mascotaId) {
            return res.status(400).json({ success: false, message: 'El ID de la mascota es requerido para eliminar' });
        }

        Veterinary.delete(mascotaId, (err, data) => {
            if (err) {
                logger.error({ err }, 'Error al eliminar el registro');
                return res.status(500).json({ success: false, message: 'Hubo un error al eliminar el registro' });
            }
            return res.status(200).json({
                success: true,
                message: 'El registro se eliminó exitosamente',
                data
            });
        });
    }
};
