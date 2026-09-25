const { pool } = require('../config/Config');

const Veterinary = {};

const getConnection = () => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            else resolve(connection);
        });
    });
};

const query = (connection, sql, params) => {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
};

const beginTransaction = async (connection) => new Promise((resolve, reject) => {
    connection.beginTransaction((err) => (err ? reject(err) : resolve()));
});
const commit = async (connection) => new Promise((resolve, reject) => {
    connection.commit((err) => (err ? reject(err) : resolve()));
});
const rollback = async (connection) => new Promise((resolve) => connection.rollback(() => resolve()));

Veterinary.getAllDoctors = (result) => {
    const sql = `SELECT id, nombre FROM doctors ORDER BY nombre ASC`;
    pool.query(sql, (err, res) => {
        if (err) result(err, null);
        else result(null, res);
    });
};

Veterinary.create = async (data, result) => {
    let connection;
    try {
        connection = await getConnection();
        await beginTransaction(connection);

        const clientData = data.client;
        const petData = data.pet;
        const stateData = data.state;
        const physicalData = data.physical;
        const paraclinicalData = data.paraclinical;

        const clientRes = await query(connection, `SELECT id FROM clients WHERE ci = ?`, [clientData.ci]);

        const proceedWithPet = async (clientId) => {
            const petSql = `
                INSERT INTO mascotas(client_id, doctor_nombre, nombre_mascota, especie, raza, edad, sexo, dieta, peso, microchip, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            const petRes = await query(connection, petSql, [
                clientId,
                petData.doctor_nombre || null,
                petData.nombre_mascota,
                petData.especie,
                petData.raza,
                petData.edad,
                petData.sexo,
                petData.dieta,
                petData.peso,
                petData.microchip || null
            ]);
            const mascotaId = petRes.insertId;

            await query(connection, `
                INSERT INTO mascota_estado(mascota_id, comportamiento, apetito, defecacion, diarrea, prenez, cirugia, inmunizaciones, desparasitacion, ingesta_agua, miccion, vomitos, celos, partos, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                mascotaId,
                stateData.comportamiento || null,
                stateData.apetito || null,
                stateData.defecacion || null,
                stateData.diarrea || null,
                stateData.prenez || null,
                stateData.cirugia || null,
                stateData.inmunizaciones || null,
                stateData.desparasitacion || null,
                stateData.ingesta_agua || null,
                stateData.miccion || null,
                stateData.vomitos || null,
                stateData.celos || null,
                stateData.partos || null
            ]);

            await query(connection, `
                INSERT INTO mascota_examen_fisico(mascota_id, temperatura, campo_pulmonar, tiempo_perfusion_capilar, membrana_mucosa, frecuencia_cardiaca, reflejo_deglutorio, frecuencia_pulso, reflejo_tusigeno, frecuencia_respiratoria, palpacion_abdominal, nodulos_linfaticos, antecedentes_clinicos, observaciones, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                mascotaId,
                physicalData.temperatura || null,
                physicalData.campo_pulmonar || null,
                physicalData.tiempo_perfusion_capilar || null,
                physicalData.membrana_mucosa || null,
                physicalData.frecuencia_cardiaca || null,
                physicalData.reflejo_deglutorio || null,
                physicalData.frecuencia_pulso || null,
                physicalData.reflejo_tusigeno || null,
                physicalData.frecuencia_respiratoria || null,
                physicalData.palpacion_abdominal || null,
                physicalData.nodulos_linfaticos || null,
                physicalData.antecedentes_clinicos || null,
                physicalData.observaciones || null
            ]);

            await query(connection, `
                INSERT INTO mascota_examenes_paraclinicos(mascota_id, perfil_quimico, hematologia, coprologia, uroanalisis, hemoparasitos, otro, diagnostico_presuntivo, tratamiento, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                mascotaId,
                paraclinicalData.perfil_quimico ? 1 : 0,
                paraclinicalData.hematologia ? 1 : 0,
                paraclinicalData.coprologia ? 1 : 0,
                paraclinicalData.uroanalisis ? 1 : 0,
                paraclinicalData.hemoparasitos ? 1 : 0,
                paraclinicalData.otro ? 1 : 0,
                paraclinicalData.diagnostico_presuntivo || null,
                paraclinicalData.tratamiento || null
            ]);

            await commit(connection);
            connection.release();
            connection = null;
            result(null, { success: true, clientId, mascotaId });
        };

        if (clientRes.length > 0) {
            const existingClientId = clientRes[0].id;
            await query(connection, `
                UPDATE clients 
                SET nombre_propietario = ?, direccion = ?, telefono = ?, fecha = ?, updated_at = NOW() 
                WHERE id = ?
            `, [clientData.nombre_propietario, clientData.direccion, clientData.telefono, clientData.fecha, existingClientId]);
            await proceedWithPet(existingClientId);
        } else {
            const insertRes = await query(connection, `
                INSERT INTO clients(nombre_propietario, ci, direccion, telefono, fecha, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, NOW(), NOW())
            `, [clientData.nombre_propietario, clientData.ci, clientData.direccion, clientData.telefono, clientData.fecha]);
            await proceedWithPet(insertRes.insertId);
        }
    } catch (err) {
        if (connection) {
            await rollback(connection);
            connection.release();
        }
        result(err, null);
    }
};

const buildHistoryFilters = (filters) => {
    const where = ['1 = 1'];
    const params = [];

    if (filters.search) {
        where.push(`(
            C.nombre_propietario LIKE ? OR C.ci LIKE ? OR M.nombre_mascota LIKE ? OR M.raza LIKE ?
        )`);
        const searchVal = `%${filters.search}%`;
        params.push(searchVal, searchVal, searchVal, searchVal);
    }
    if (filters.especie) {
        where.push('M.especie = ?');
        params.push(filters.especie);
    }
    if (filters.doctor_nombre) {
        where.push('M.doctor_nombre LIKE ?');
        params.push(`%${filters.doctor_nombre}%`);
    }
    if (filters.fecha_inicio && filters.fecha_fin) {
        where.push('C.fecha BETWEEN ? AND ?');
        params.push(filters.fecha_inicio, filters.fecha_fin);
    }

    return { whereSql: where.join(' AND '), params };
};

Veterinary.getAll = (filters, pagination, result) => {
    const { limit, offset } = pagination;
    const { whereSql, params } = buildHistoryFilters(filters);

    const fromSql = `
        FROM mascotas AS M
        INNER JOIN clients AS C ON M.client_id = C.id
        LEFT JOIN mascota_estado AS ME ON ME.mascota_id = M.id
        LEFT JOIN mascota_examen_fisico AS MF ON MF.mascota_id = M.id
        LEFT JOIN mascota_examenes_paraclinicos AS MP ON MP.mascota_id = M.id
        WHERE ${whereSql}
    `;

    const countSql = `SELECT COUNT(*) AS total ${fromSql}`;
    const dataSql = `
        SELECT 
            C.id AS client_id, C.nombre_propietario, C.ci, C.direccion, C.telefono, DATE_FORMAT(C.fecha, '%Y-%m-%d') AS fecha,
            M.id AS mascota_id, M.nombre_mascota, M.especie, M.raza, M.edad, M.sexo, M.dieta, M.peso, M.microchip,
            M.doctor_nombre,
            ME.comportamiento, ME.apetito, ME.defecacion, ME.diarrea, ME.prenez, ME.cirugia, ME.inmunizaciones, ME.desparasitacion, ME.ingesta_agua, ME.miccion, ME.vomitos, ME.celos, ME.partos,
            MF.temperatura, MF.campo_pulmonar, MF.tiempo_perfusion_capilar, MF.membrana_mucosa, MF.frecuencia_cardiaca, MF.reflejo_deglutorio, MF.frecuencia_pulso, MF.reflejo_tusigeno, MF.frecuencia_respiratoria, MF.palpacion_abdominal, MF.nodulos_linfaticos, MF.antecedentes_clinicos, MF.observaciones,
            MP.perfil_quimico, MP.hematologia, MP.coprologia, MP.uroanalisis, MP.hemoparasitos, MP.otro, MP.diagnostico_presuntivo, MP.tratamiento
        ${fromSql}
        ORDER BY M.created_at DESC
        LIMIT ? OFFSET ?
    `;

    pool.query(countSql, params, (errCount, countRes) => {
        if (errCount) return result(errCount, null);
        pool.query(dataSql, [...params, limit, offset], (err, res) => {
            if (err) result(err, null);
            else result(null, { rows: res, total: countRes[0].total });
        });
    });
};

Veterinary.update = async (mascotaId, data, result) => {
    let connection;
    try {
        connection = await getConnection();
        await beginTransaction(connection);

        const clientData = data.client;
        const petData = data.pet;
        const stateData = data.state;
        const physicalData = data.physical;
        const paraclinicalData = data.paraclinical;

        const mascotaRes = await query(connection, `SELECT client_id FROM mascotas WHERE id = ?`, [mascotaId]);
        if (mascotaRes.length === 0) {
            await rollback(connection);
            connection.release();
            return result(new Error('Mascota no encontrada'), null);
        }

        const clientId = mascotaRes[0].client_id;

        await query(connection, `
            UPDATE clients 
            SET nombre_propietario = ?, ci = ?, direccion = ?, telefono = ?, fecha = ?, updated_at = NOW()
            WHERE id = ?
        `, [clientData.nombre_propietario, clientData.ci, clientData.direccion, clientData.telefono, clientData.fecha, clientId]);

        await query(connection, `
            UPDATE mascotas 
            SET doctor_nombre = ?, nombre_mascota = ?, especie = ?, raza = ?, edad = ?, sexo = ?, dieta = ?, peso = ?, microchip = ?, updated_at = NOW()
            WHERE id = ?
        `, [
            petData.doctor_nombre || null,
            petData.nombre_mascota,
            petData.especie,
            petData.raza,
            petData.edad,
            petData.sexo,
            petData.dieta,
            petData.peso,
            petData.microchip || null,
            mascotaId
        ]);

        await query(connection, `
            UPDATE mascota_estado 
            SET comportamiento = ?, apetito = ?, defecacion = ?, diarrea = ?, prenez = ?, cirugia = ?, inmunizaciones = ?, desparasitacion = ?, ingesta_agua = ?, miccion = ?, vomitos = ?, celos = ?, partos = ?, updated_at = NOW()
            WHERE mascota_id = ?
        `, [
            stateData.comportamiento || null,
            stateData.apetito || null,
            stateData.defecacion || null,
            stateData.diarrea || null,
            stateData.prenez || null,
            stateData.cirugia || null,
            stateData.inmunizaciones || null,
            stateData.desparasitacion || null,
            stateData.ingesta_agua || null,
            stateData.miccion || null,
            stateData.vomitos || null,
            stateData.celos || null,
            stateData.partos || null,
            mascotaId
        ]);

        await query(connection, `
            UPDATE mascota_examen_fisico 
            SET temperatura = ?, campo_pulmonar = ?, tiempo_perfusion_capilar = ?, membrana_mucosa = ?, frecuencia_cardiaca = ?, reflejo_deglutorio = ?, frecuencia_pulso = ?, reflejo_tusigeno = ?, frecuencia_respiratoria = ?, palpacion_abdominal = ?, nodulos_linfaticos = ?, antecedentes_clinicos = ?, observaciones = ?, updated_at = NOW()
            WHERE mascota_id = ?
        `, [
            physicalData.temperatura || null,
            physicalData.campo_pulmonar || null,
            physicalData.tiempo_perfusion_capilar || null,
            physicalData.membrana_mucosa || null,
            physicalData.frecuencia_cardiaca || null,
            physicalData.reflejo_deglutorio || null,
            physicalData.frecuencia_pulso || null,
            physicalData.reflejo_tusigeno || null,
            physicalData.frecuencia_respiratoria || null,
            physicalData.palpacion_abdominal || null,
            physicalData.nodulos_linfaticos || null,
            physicalData.antecedentes_clinicos || null,
            physicalData.observaciones || null,
            mascotaId
        ]);

        await query(connection, `
            UPDATE mascota_examenes_paraclinicos 
            SET perfil_quimico = ?, hematologia = ?, coprologia = ?, uroanalisis = ?, hemoparasitos = ?, otro = ?, diagnostico_presuntivo = ?, tratamiento = ?, updated_at = NOW()
            WHERE mascota_id = ?
        `, [
            paraclinicalData.perfil_quimico ? 1 : 0,
            paraclinicalData.hematologia ? 1 : 0,
            paraclinicalData.coprologia ? 1 : 0,
            paraclinicalData.uroanalisis ? 1 : 0,
            paraclinicalData.hemoparasitos ? 1 : 0,
            paraclinicalData.otro ? 1 : 0,
            paraclinicalData.diagnostico_presuntivo || null,
            paraclinicalData.tratamiento || null,
            mascotaId
        ]);

        await commit(connection);
        connection.release();
        connection = null;
        result(null, { success: true });
    } catch (err) {
        if (connection) {
            await rollback(connection);
            connection.release();
        }
        result(err, null);
    }
};

Veterinary.delete = async (mascotaId, result) => {
    let connection;
    try {
        connection = await getConnection();
        await beginTransaction(connection);

        const mascotaRes = await query(connection, `SELECT client_id FROM mascotas WHERE id = ?`, [mascotaId]);
        if (mascotaRes.length === 0) {
            await rollback(connection);
            connection.release();
            return result(new Error('Registro no encontrado'), null);
        }

        const clientId = mascotaRes[0].client_id;
        await query(connection, `DELETE FROM mascotas WHERE id = ?`, [mascotaId]);

        const otherPets = await query(connection, `SELECT id FROM mascotas WHERE client_id = ? LIMIT 1`, [clientId]);
        if (otherPets.length === 0) {
            await query(connection, `DELETE FROM clients WHERE id = ?`, [clientId]);
        }

        await commit(connection);
        connection.release();
        connection = null;
        result(null, { success: true });
    } catch (err) {
        if (connection) {
            await rollback(connection);
            connection.release();
        }
        result(err, null);
    }
};

module.exports = Veterinary;
