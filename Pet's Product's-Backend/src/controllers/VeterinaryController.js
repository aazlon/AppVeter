const Veterinary = require('../models/Veterinary');
const { parsePagination, buildPagination } = require('../utils/pagination');
const logger = require('../utils/logger');
const { isNonEmptyString, isValidId, isValidDateOnly } = require('../utils/validators');

// Valida las secciones del formulario de historia clínica antes de tocar la
// base de datos. `client` y `pet` son obligatorias (coinciden con los campos
// NOT NULL de clients/mascotas); `state`, `physical` y `paraclinical` son
// opcionales, pero si se envían deben ser objetos.
function validateHistorySections(historyData) {
    if (!historyData || typeof historyData !== 'object') {
        return 'Debe enviar los datos de la historia clínica';
    }

    const client = historyData.client;
    if (!client || typeof client !== 'object') {
        return 'Los datos del cliente son requeridos';
    }
    if (!isNonEmptyString(client.nombre_propietario, 255) || !isNonEmptyString(client.ci, 50) || !isNonEmptyString(client.telefono, 50)) {
        return 'Los datos del cliente (nombre, C.I., teléfono) son requeridos';
    }
    if (!isNonEmptyString(client.direccion, 65535)) {
        return 'La dirección del cliente es requerida';
    }
    if (!isValidDateOnly(client.fecha)) {
        return 'La fecha del cliente debe tener un formato válido (AAAA-MM-DD)';
    }

    const pet = historyData.pet;
    if (!pet || typeof pet !== 'object') {
        return 'Los datos de la mascota son requeridos';
    }
    if (!isNonEmptyString(pet.nombre_mascota, 255) || !isNonEmptyString(pet.especie, 100) || !isNonEmptyString(pet.raza, 100)) {
        return 'Los datos de la mascota (nombre, especie, raza) son requeridos';
    }
    if (!isNonEmptyString(pet.edad, 50) || !isNonEmptyString(pet.sexo, 20) || !isNonEmptyString(pet.dieta, 255) || !isNonEmptyString(pet.peso, 50)) {
        return 'Los datos de la mascota (edad, sexo, dieta, peso) son requeridos';
    }
    if (pet.microchip !== undefined && pet.microchip !== null && !isNonEmptyString(pet.microchip, 100)) {
        return 'El microchip no es válido';
    }

    for (const section of ['state', 'physical', 'paraclinical']) {
        const value = historyData[section];
        if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
            return `La sección "${section}" debe ser un objeto`;
        }
    }

    return null;
}

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

        const error = validateHistorySections(historyData);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        // Las secciones opcionales ausentes se normalizan a objetos vacíos: el
        // modelo las recorre y todos sus campos son anulables en la base.
        historyData.state = historyData.state || {};
        historyData.physical = historyData.physical || {};
        historyData.paraclinical = historyData.paraclinical || {};

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

        // El rango de fechas se exige completo y con formato válido: un solo
        // extremo suelto responde 400 en vez de ignorarse en silencio.
        if (filters.fecha_inicio && !filters.fecha_fin) {
            return res.status(400).json({ success: false, message: 'Debe indicar fecha_inicio y fecha_fin juntas (o ninguna)' });
        }
        if (filters.fecha_fin && !filters.fecha_inicio) {
            return res.status(400).json({ success: false, message: 'Debe indicar fecha_inicio y fecha_fin juntas (o ninguna)' });
        }
        if (filters.fecha_inicio && !isValidDateOnly(filters.fecha_inicio)) {
            return res.status(400).json({ success: false, message: 'La fecha de inicio debe tener un formato válido (AAAA-MM-DD)' });
        }
        if (filters.fecha_fin && !isValidDateOnly(filters.fecha_fin)) {
            return res.status(400).json({ success: false, message: 'La fecha de fin debe tener un formato válido (AAAA-MM-DD)' });
        }
        if (filters.fecha_inicio && filters.fecha_fin && filters.fecha_inicio > filters.fecha_fin) {
            return res.status(400).json({ success: false, message: 'La fecha de inicio no puede ser posterior a la fecha de fin' });
        }

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

        if (!isValidId(mascotaId)) {
            return res.status(400).json({ success: false, message: 'El identificador de la historia clínica no es válido' });
        }

        // Mismas reglas que al registrar: la actualización reemplaza la ficha
        // completa, por lo que los datos de cliente y mascota siguen siendo
        // obligatorios.
        const error = validateHistorySections(historyData);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        historyData.state = historyData.state || {};
        historyData.physical = historyData.physical || {};
        historyData.paraclinical = historyData.paraclinical || {};

        Veterinary.update(mascotaId, historyData, (err, data) => {
            if (err) {
                if (err.notFound) {
                    return res.status(404).json({ success: false, message: 'Historia clínica no encontrada' });
                }
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

        if (!isValidId(mascotaId)) {
            return res.status(400).json({ success: false, message: 'El identificador de la historia clínica no es válido' });
        }

        Veterinary.delete(mascotaId, (err, data) => {
            if (err) {
                if (err.notFound) {
                    return res.status(404).json({ success: false, message: 'Historia clínica no encontrada' });
                }
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
