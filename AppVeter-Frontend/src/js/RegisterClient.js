import { initNotificationModal, loadNotificationCount } from './NotificationModal.js';
import { showSuccessModal } from './SuccessModal.js';
import { getRoleFlags, requireAuth } from './Roles.js';
import { renderLayout } from './Layout.js';
import { apiFetch, apiUrl } from './api.js';
import { escapeHtml, escapeAttr } from './security.js';

document.addEventListener('DOMContentLoaded', () => {

    const userData = requireAuth();
    if (!userData) return;

    renderLayout();
    const { isAdmin, isVeterinario } = getRoleFlags(userData);

    if (!isAdmin && !isVeterinario) {
        alert('Acceso exclusivo para administradores y veterinarios. Redirigiendo...');
        window.location.href = './UserScreen.html';
        return;
    }

    const userNameDisplay = document.getElementById('user-name');
    const userAvatarDisplay = document.getElementById('user-avatar');
    const btnDeleteRecep = document.getElementById('btn-delete-recep');
    const notificationBadge = document.getElementById('notification-badge');
    
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const tabManageBtn = document.getElementById('tab-manage-btn');

    
    const historyForm = document.getElementById('historyForm');
    const saveHistoryBtn = document.getElementById('save-history-btn');
    const doctorInput = document.getElementById('doctor_nombre');

    
    const editingBanner = document.getElementById('editing-banner');
    const editingPetName = document.getElementById('editing-pet-name');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    
    const filterSearch = document.getElementById('filter-search');
    const filterEspecie = document.getElementById('filter-especie');
    const filterDoctor = document.getElementById('filter-doctor');
    const filterFechaInicio = document.getElementById('filter-fecha-inicio');
    const filterFechaFin = document.getElementById('filter-fecha-fin');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    
    const recordsTbody = document.getElementById('records-tbody');
    const recordsCounter = document.getElementById('records-counter');

    
    const detailsModal = document.getElementById('details-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalDetailsBody = document.getElementById('modal-details-body');
    const modalCloseAction = document.getElementById('modal-close-action');
    const modalEditAction = document.getElementById('modal-edit-action');


    const VETERINARY_API = '/veterinary';
    let isEditMode = false;
    let editingMascotaId = null;
    let allRecords = [];
    let activeModalRecord = null;
    let currentPage = 1;
    let totalPages = 1;
    let recordsAbortController = null;
    let loadingRecords = false;
    const recordDeletesInFlight = new Set();


    const fullName = userData.name || userData.nombre || userData.username || 'Secretaria';
    userNameDisplay.textContent = fullName;
    if (userData.image || userData.foto) {
        userAvatarDisplay.src = userData.image || userData.foto;
    }

    
    const dateInput = document.getElementById('fecha');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }


    if (isAdmin) {
        if (btnDeleteRecep) {
            btnDeleteRecep.style.display = 'inline-block';
            btnDeleteRecep.addEventListener('click', () => window.location.href = './DeleteRecep.html');
        }
    }

    initNotificationModal(userData);
    if (notificationBadge) loadNotificationCount(notificationBadge);


    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetTab = trigger.getAttribute('data-tab');

            
            tabTriggers.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            
            trigger.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            
            if (targetTab === 'tab-manage') {
                loadHistories();
            }
        });
    });


    historyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        
        const payload = {
            client: {
                nombre_propietario: document.getElementById('nombre_propietario').value.trim(),
                ci: document.getElementById('ci').value.trim(),
                telefono: document.getElementById('telefono').value.trim(),
                fecha: document.getElementById('fecha').value,
                direccion: document.getElementById('direccion').value.trim()
            },
            pet: {
                nombre_mascota: document.getElementById('nombre_mascota').value.trim(),
                especie: document.getElementById('especie').value,
                raza: document.getElementById('raza').value.trim(),
                edad: document.getElementById('edad').value.trim(),
                sexo: document.getElementById('sexo').value,
                peso: document.getElementById('peso').value.trim(),
                dieta: document.getElementById('dieta').value.trim(),
                microchip: document.getElementById('microchip').value.trim(),
                doctor_nombre: document.getElementById('doctor_nombre').value.trim()
            },
            state: {
                comportamiento: document.getElementById('comportamiento').value.trim(),
                apetito: document.getElementById('apetito').value.trim(),
                defecacion: document.getElementById('defecacion').value.trim(),
                diarrea: document.getElementById('diarrea').value.trim(),
                prenez: document.getElementById('prenez').value.trim(),
                cirugia: document.getElementById('cirugia').value.trim(),
                inmunizaciones: document.getElementById('inmunizaciones').value.trim(),
                desparasitacion: document.getElementById('desparasitacion').value.trim(),
                ingesta_agua: document.getElementById('ingesta_agua').value.trim(),
                miccion: document.getElementById('miccion').value.trim(),
                vomitos: document.getElementById('vomitos').value.trim(),
                celos: document.getElementById('celos').value.trim(),
                partos: document.getElementById('partos').value.trim()
            },
            physical: {
                temperatura: document.getElementById('temperatura').value.trim(),
                campo_pulmonar: document.getElementById('campo_pulmonar').value.trim(),
                tiempo_perfusion_capilar: document.getElementById('tiempo_perfusion_capilar').value.trim(),
                membrana_mucosa: document.getElementById('membrana_mucosa').value.trim(),
                frecuencia_cardiaca: document.getElementById('frecuencia_cardiaca').value.trim(),
                reflejo_deglutorio: document.getElementById('reflejo_deglutorio').value.trim(),
                frecuencia_pulso: document.getElementById('frecuencia_pulso').value.trim(),
                reflejo_tusigeno: document.getElementById('reflejo_tusigeno').value.trim(),
                frecuencia_respiratoria: document.getElementById('frecuencia_respiratoria').value.trim(),
                palpacion_abdominal: document.getElementById('palpacion_abdominal').value.trim(),
                nodulos_linfaticos: document.getElementById('nodulos_linfaticos').value.trim(),
                antecedentes_clinicos: document.getElementById('antecedentes_clinicos').value.trim(),
                observaciones: document.getElementById('observaciones').value.trim()
            },
            paraclinical: {
                perfil_quimico: document.getElementById('perfil_quimico').checked,
                hematologia: document.getElementById('hematologia').checked,
                coprologia: document.getElementById('coprologia').checked,
                uroanalisis: document.getElementById('uroanalisis').checked,
                hemoparasitos: document.getElementById('hemoparasitos').checked,
                otro: document.getElementById('otro').checked,
                diagnostico_presuntivo: document.getElementById('diagnostico_presuntivo').value.trim(),
                tratamiento: document.getElementById('tratamiento').value.trim()
            }
        };

        
        const url = isEditMode ? `${VETERINARY_API}/records/${editingMascotaId}` : `${VETERINARY_API}/register`;
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            saveHistoryBtn.disabled = true;
            saveHistoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const response = await apiFetch(url, {
                method: method,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showSuccessModal(
                    isEditMode ? '¡Historia clínica modificada exitosamente!' : '¡Historia clínica registrada correctamente!',
                    null
                );
                
                setTimeout(() => {
                    resetForm();
                    tabManageBtn.click();
                }, 2400);
            } else {
                showSuccessModal(`Error al guardar: ${result.message}`, null);
            }
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            showSuccessModal('Error de red. Asegúrate de que el backend esté encendido.', null);
        } finally {
            saveHistoryBtn.disabled = false;
            saveHistoryBtn.innerHTML = isEditMode ? '<i class="fas fa-save"></i> Guardar Cambios' : '<i class="fas fa-save"></i> Registrar Historia Clínica';
        }
    });

    
    function resetForm() {
        historyForm.reset();
        
        
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;

        disableEditMode();
    }

    
    function disableEditMode() {
        isEditMode = false;
        editingMascotaId = null;
        editingBanner.classList.remove('active');
        saveHistoryBtn.innerHTML = '<i class="fas fa-save"></i> Registrar Historia Clínica';
    }

    
    cancelEditBtn.addEventListener('click', resetForm);


    async function loadHistories(resetPage = true) {
        if (resetPage) currentPage = 1;

        if (recordsAbortController) recordsAbortController.abort();
        const controller = new AbortController();
        recordsAbortController = controller;
        const signal = controller.signal;
        loadingRecords = true;

        const queryParams = apiUrl(`${VETERINARY_API}/records`, {
            search: filterSearch.value.trim(),
            especie: filterEspecie.value,
            doctor_nombre: filterDoctor.value.trim(),
            fecha_inicio: filterFechaInicio.value,
            fecha_fin: filterFechaFin.value,
            page: currentPage,
            limit: 20
        });

        try {
            recordsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-td">
                        <div class="spinner"></div> Cargando historias clínicas de la base de datos...
                    </td>
                </tr>
            `;

            const response = await apiFetch(queryParams, { signal });
            const result = await response.json();

            if (result.success && result.data) {
                allRecords = result.data;
                totalPages = (result.pagination && result.pagination.totalPages) || 1;
                renderRecordsTable(allRecords, result.pagination);
            } else {
                recordsTbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading-td text-danger">
                            <i class="fas fa-exclamation-triangle"></i> Error al cargar datos: ${escapeHtml(result.message)}
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Error al conectar con la API de registros:', error);
            recordsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-td">
                        <i class="fas fa-plug"></i> No se pudo conectar con el servidor backend
                    </td>
                </tr>
            `;
        } finally {
            if (recordsAbortController === controller) loadingRecords = false;
        }
    }

    
    function renderRecordsTable(records, pagination) {
        recordsTbody.innerHTML = '';
        if (pagination) {
            recordsCounter.textContent = `${pagination.total} registro(s) — Página ${pagination.page}/${pagination.totalPages}`;
        } else {
            recordsCounter.textContent = `${records.length} registro(s) encontrado(s)`;
        }

        if (records.length === 0) {
            recordsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-td">
                        <i class="fas fa-info-circle"></i> No se encontraron historias clínicas con los filtros aplicados.
                    </td>
                </tr>
            `;
            renderPaginationControls();
            return;
        }

        records.forEach(rec => {
            const tr = document.createElement('tr');

            
            let badgeClass = 'badge-exo';
            let especieName = 'Exótico';
            if (rec.especie === 'CAN') { badgeClass = 'badge-can'; especieName = 'Canino'; }
            else if (rec.especie === 'FEL') { badgeClass = 'badge-fel'; especieName = 'Felino'; }
            else if (rec.especie === 'AVE') { badgeClass = 'badge-ave'; especieName = 'Ave'; }

            tr.innerHTML = `
                <td><strong>${escapeHtml(rec.fecha)}</strong></td>
                <td>
                    <span class="owner-name">${escapeHtml(rec.nombre_propietario)}</span>
                    <span class="owner-ci">C.I. ${escapeHtml(rec.ci)}</span>
                </td>
                <td>${escapeHtml(rec.telefono)}</td>
                <td>
                    <span class="pet-label">${escapeHtml(rec.nombre_mascota)}</span>
                    <span class="specie-badge ${escapeAttr(badgeClass)}">${escapeHtml(especieName)} (${escapeHtml(rec.raza)})</span>
                </td>
                <td><i class="fas fa-user-md text-muted"></i> Dra/Dr. ${escapeHtml(rec.doctor_nombre) || 'No asignado'}</td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(rec.diagnostico_presuntivo)}">
                    ${escapeHtml(rec.diagnostico_presuntivo)}
                </td>
                <td class="actions-col">
                    <div class="actions-wrapper">
                        <button class="action-btn btn-view" title="Ver Detalle" data-id="${escapeAttr(rec.mascota_id)}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-edit-row" title="Editar Registro" data-id="${escapeAttr(rec.mascota_id)}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" title="Eliminar Registro" data-id="${escapeAttr(rec.mascota_id)}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;

            
            tr.querySelector('.btn-view').addEventListener('click', () => openDetailsModal(rec));
            tr.querySelector('.btn-edit-row').addEventListener('click', () => enableEditModeWithRecord(rec));
            tr.querySelector('.btn-delete').addEventListener('click', () => deleteRecordConfirm(rec.mascota_id, rec.nombre_mascota));

            recordsTbody.appendChild(tr);
        });

        renderPaginationControls();
    }

    function renderPaginationControls() {
        let controls = document.getElementById('records-pagination-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'records-pagination-controls';
            controls.style.cssText = 'display:flex;gap:0.5rem;justify-content:center;align-items:center;margin-top:1rem;';
            recordsCounter.parentElement.appendChild(controls);
        }
        controls.innerHTML = `
            <button class="btn-pagination-prev" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
            <span>Página ${currentPage} de ${totalPages}</span>
            <button class="btn-pagination-next" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente <i class="fas fa-chevron-right"></i></button>
        `;
        const prevBtn = controls.querySelector('.btn-pagination-prev');
        const nextBtn = controls.querySelector('.btn-pagination-next');

        prevBtn.addEventListener('click', () => {
            if (loadingRecords || currentPage <= 1) return;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            currentPage--;
            loadHistories(false);
        });
        nextBtn.addEventListener('click', () => {
            if (loadingRecords || currentPage >= totalPages) return;
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            currentPage++;
            loadHistories(false);
        });
    }


    function openDetailsModal(record) {
        activeModalRecord = record;

        let especieTxt = 'Exótico';
        if (record.especie === 'CAN') especieTxt = 'Canino (Perro)';
        else if (record.especie === 'FEL') especieTxt = 'Felino (Gato)';
        else if (record.especie === 'AVE') especieTxt = 'Ave';

        modalDetailsBody.innerHTML = `
            <div class="details-section">
                <h3><i class="fas fa-user-circle"></i> Información del Propietario</h3>
                <div class="details-grid">
                    <div class="details-item"><strong>Nombre Completo:</strong> <span>${escapeHtml(record.nombre_propietario)}</span></div>
                    <div class="details-item"><strong>Cédula de Identidad:</strong> <span>${escapeHtml(record.ci)}</span></div>
                    <div class="details-item"><strong>Teléfono de Contacto:</strong> <span>${escapeHtml(record.telefono)}</span></div>
                    <div class="details-item"><strong>Fecha Registro:</strong> <span>${escapeHtml(record.fecha)}</span></div>
                    <div class="details-item span-full"><strong>Dirección:</strong> <span>${escapeHtml(record.direccion)}</span></div>
                </div>
            </div>

            <div class="details-section">
                <h3><i class="fas fa-paw"></i> Datos de la Mascota</h3>
                <div class="details-grid">
                    <div class="details-item"><strong>Nombre Mascota:</strong> <span>${escapeHtml(record.nombre_mascota)}</span></div>
                    <div class="details-item"><strong>Especie:</strong> <span>${escapeHtml(especieTxt)}</span></div>
                    <div class="details-item"><strong>Raza:</strong> <span>${escapeHtml(record.raza)}</span></div>
                    <div class="details-item"><strong>Edad:</strong> <span>${escapeHtml(record.edad)}</span></div>
                    <div class="details-item"><strong>Sexo:</strong> <span>${record.sexo === 'M' ? 'Macho' : 'Hembra'}</span></div>
                    <div class="details-item"><strong>Peso Registrado:</strong> <span>${escapeHtml(record.peso)}</span></div>
                    <div class="details-item"><strong>Dieta Alimenticia:</strong> <span>${escapeHtml(record.dieta)}</span></div>
                    <div class="details-item"><strong>Microchip / Pedigree:</strong> <span>${escapeHtml(record.microchip) || 'Ninguno'}</span></div>
                    <div class="details-item span-full"><strong>Doctor a Cargo:</strong> <span>Dr/Dra. ${escapeHtml(record.doctor_nombre) || 'No asignado'}</span></div>
                </div>
            </div>

            <div class="details-section">
                <h3><i class="fas fa-history"></i> Anamnesis / Estado de la Mascota</h3>
                <div class="details-grid">
                    <div class="details-item"><strong>Comportamiento:</strong> <span>${escapeHtml(record.comportamiento) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Apetito:</strong> <span>${escapeHtml(record.apetito) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Defecación:</strong> <span>${escapeHtml(record.defecacion) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Diarrea:</strong> <span>${escapeHtml(record.diarrea) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Preñez:</strong> <span>${escapeHtml(record.prenez) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Cirugías Previas:</strong> <span>${escapeHtml(record.cirugia) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Inmunizaciones:</strong> <span>${escapeHtml(record.inmunizaciones) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Última Desparasitación:</strong> <span>${escapeHtml(record.desparasitacion) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Ingesta Agua:</strong> <span>${escapeHtml(record.ingesta_agua) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Micción:</strong> <span>${escapeHtml(record.miccion) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Vómitos:</strong> <span>${escapeHtml(record.vomitos) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Celos:</strong> <span>${escapeHtml(record.celos) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Partos Anteriores:</strong> <span>${escapeHtml(record.partos) || 'No registrado'}</span></div>
                </div>
            </div>

            <div class="details-section">
                <h3><i class="fas fa-stethoscope"></i> Examen Físico Completo</h3>
                <div class="details-grid">
                    <div class="details-item"><strong>Temperatura:</strong> <span>${escapeHtml(record.temperatura) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Campo Pulmonar:</strong> <span>${escapeHtml(record.campo_pulmonar) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>TPC (Perfusión):</strong> <span>${escapeHtml(record.tiempo_perfusion_capilar) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Membrana Mucosa:</strong> <span>${escapeHtml(record.membrana_mucosa) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Frecuencia Cardíaca:</strong> <span>${escapeHtml(record.frecuencia_cardiaca) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Reflejo Deglutorio:</strong> <span>${escapeHtml(record.reflejo_deglutorio) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Frecuencia de Pulso:</strong> <span>${escapeHtml(record.frecuencia_pulso) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Reflejo Tusígeno:</strong> <span>${escapeHtml(record.reflejo_tusigeno) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Frecuencia Respiratoria:</strong> <span>${escapeHtml(record.frecuencia_respiratoria) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Palpación Abdominal:</strong> <span>${escapeHtml(record.palpacion_abdominal) || 'No registrado'}</span></div>
                    <div class="details-item"><strong>Nódulos Linfáticos:</strong> <span>${escapeHtml(record.nodulos_linfaticos) || 'No registrado'}</span></div>
                    
                    <div class="details-item span-full">
                        <strong>Antecedentes Clínicos:</strong>
                        <div class="detail-textarea-box">${escapeHtml(record.antecedentes_clinicos) || 'Ninguno registrado.'}</div>
                    </div>
                    <div class="details-item span-full">
                        <strong>Observaciones Generales:</strong>
                        <div class="detail-textarea-box">${escapeHtml(record.observaciones) || 'Ninguna observación.'}</div>
                    </div>
                </div>
            </div>

            <div class="details-section">
                <h3><i class="fas fa-flask"></i> Exámenes Paraclínicos y Prescripción</h3>
                <div class="details-grid">
                    <div class="details-item span-full">
                        <strong>Exámenes Solicitados:</strong>
                        <div class="para-badge-grid">
                            <span class="para-badge ${record.perfil_quimico ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.perfil_quimico ? 'fa-check' : 'fa-times'}"></i> Perfil Químico
                            </span>
                            <span class="para-badge ${record.hematologia ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.hematologia ? 'fa-check' : 'fa-times'}"></i> Hematología
                            </span>
                            <span class="para-badge ${record.coprologia ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.coprologia ? 'fa-check' : 'fa-times'}"></i> Coprología
                            </span>
                            <span class="para-badge ${record.uroanalisis ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.uroanalisis ? 'fa-check' : 'fa-times'}"></i> Uroanálisis
                            </span>
                            <span class="para-badge ${record.hemoparasitos ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.hemoparasitos ? 'fa-check' : 'fa-times'}"></i> Hemoparásitos
                            </span>
                            <span class="para-badge ${record.otro ? 'checked' : 'unchecked'}">
                                <i class="fas ${record.otro ? 'fa-check' : 'fa-times'}"></i> Otros exámenes
                            </span>
                        </div>
                    </div>

                    <div class="details-item span-full">
                        <strong>Diagnóstico Presuntivo:</strong>
                        <div class="detail-textarea-box" style="border-left: 4px solid var(--accent-color);">${escapeHtml(record.diagnostico_presuntivo)}</div>
                    </div>

                    <div class="details-item span-full">
                        <strong>Tratamiento Médico Recetado:</strong>
                        <div class="detail-textarea-box" style="border-left: 4px solid var(--success-color);">${escapeHtml(record.tratamiento) || 'Ninguno recetado.'}</div>
                    </div>
                </div>
            </div>
        `;

        detailsModal.classList.add('active');
    }

    
    function closeModal() {
        detailsModal.classList.remove('active');
        activeModalRecord = null;
    }

    closeModalBtn.addEventListener('click', closeModal);
    modalCloseAction.addEventListener('click', closeModal);

    
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) closeModal();
    });

    
    modalEditAction.addEventListener('click', () => {
        if (activeModalRecord) {
            const rec = activeModalRecord;
            closeModal();
            enableEditModeWithRecord(rec);
        }
    });


    function enableEditModeWithRecord(record) {
        isEditMode = true;
        editingMascotaId = record.mascota_id;

        
        editingPetName.textContent = `${record.nombre_mascota} (${record.nombre_propietario})`;
        editingBanner.classList.add('active');


        document.getElementById('nombre_propietario').value = record.nombre_propietario || '';
        document.getElementById('ci').value = record.ci || '';
        document.getElementById('telefono').value = record.telefono || '';
        document.getElementById('direccion').value = record.direccion || '';
        document.getElementById('fecha').value = record.fecha || '';

        
        document.getElementById('nombre_mascota').value = record.nombre_mascota || '';
        document.getElementById('especie').value = record.especie || '';
        document.getElementById('raza').value = record.raza || '';
        document.getElementById('edad').value = record.edad || '';
        document.getElementById('sexo').value = record.sexo || '';
        document.getElementById('peso').value = record.peso || '';
        document.getElementById('dieta').value = record.dieta || '';
        document.getElementById('microchip').value = record.microchip || '';
        document.getElementById('doctor_nombre').value = record.doctor_nombre || '';

        
        document.getElementById('comportamiento').value = record.comportamiento || '';
        document.getElementById('apetito').value = record.apetito || '';
        document.getElementById('defecacion').value = record.defecacion || '';
        document.getElementById('diarrea').value = record.diarrea || '';
        document.getElementById('prenez').value = record.prenez || '';
        document.getElementById('cirugia').value = record.cirugia || '';
        document.getElementById('inmunizaciones').value = record.inmunizaciones || '';
        document.getElementById('desparasitacion').value = record.desparasitacion || '';
        document.getElementById('ingesta_agua').value = record.ingesta_agua || '';
        document.getElementById('miccion').value = record.miccion || '';
        document.getElementById('vomitos').value = record.vomitos || '';
        document.getElementById('celos').value = record.celos || '';
        document.getElementById('partos').value = record.partos || '';

        
        document.getElementById('temperatura').value = record.temperatura || '';
        document.getElementById('campo_pulmonar').value = record.campo_pulmonar || '';
        document.getElementById('tiempo_perfusion_capilar').value = record.tiempo_perfusion_capilar || '';
        document.getElementById('membrana_mucosa').value = record.membrana_mucosa || '';
        document.getElementById('frecuencia_cardiaca').value = record.frecuencia_cardiaca || '';
        document.getElementById('reflejo_deglutorio').value = record.reflejo_deglutorio || '';
        document.getElementById('frecuencia_pulso').value = record.frecuencia_pulso || '';
        document.getElementById('reflejo_tusigeno').value = record.reflejo_tusigeno || '';
        document.getElementById('frecuencia_respiratoria').value = record.frecuencia_respiratoria || '';
        document.getElementById('palpacion_abdominal').value = record.palpacion_abdominal || '';
        document.getElementById('nodulos_linfaticos').value = record.nodulos_linfaticos || '';
        document.getElementById('antecedentes_clinicos').value = record.antecedentes_clinicos || '';
        document.getElementById('observaciones').value = record.observaciones || '';

        
        document.getElementById('perfil_quimico').checked = !!record.perfil_quimico;
        document.getElementById('hematologia').checked = !!record.hematologia;
        document.getElementById('coprologia').checked = !!record.coprologia;
        document.getElementById('uroanalisis').checked = !!record.uroanalisis;
        document.getElementById('hemoparasitos').checked = !!record.hemoparasitos;
        document.getElementById('otro').checked = !!record.otro;
        document.getElementById('diagnostico_presuntivo').value = record.diagnostico_presuntivo || '';
        document.getElementById('tratamiento').value = record.tratamiento || '';

        
        saveHistoryBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';

        
        tabRegisterBtn.click();

        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }


    async function deleteRecordConfirm(mascotaId, petName) {
        if (recordDeletesInFlight.has(mascotaId)) return;
        const check = confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente la historia clínica de ${petName}?\nEsta acción no se puede deshacer.`);
        
        if (!check) return;

        recordDeletesInFlight.add(mascotaId);
        try {
            const response = await apiFetch(`${VETERINARY_API}/records/${mascotaId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                alert('¡El registro se ha eliminado exitosamente!');
                loadHistories(); // Recargar tabla
            } else {
                alert(`Error al eliminar: ${result.message}`);
            }
        } catch (error) {
            console.error('Error al eliminar registro:', error);
            alert('Error de red al intentar eliminar.');
        } finally {
            recordDeletesInFlight.delete(mascotaId);
        }
    }


    let searchTimeout = null;
    filterSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadHistories, 300);
    });

    filterEspecie.addEventListener('change', loadHistories);
    filterDoctor.addEventListener('change', loadHistories);
    filterFechaInicio.addEventListener('change', loadHistories);
    filterFechaFin.addEventListener('change', loadHistories);

    
    clearFiltersBtn.addEventListener('click', () => {
        filterSearch.value = '';
        filterEspecie.value = '';
        filterDoctor.value = '';
        filterFechaInicio.value = '';
        filterFechaFin.value = '';
        loadHistories(true);
    });


});
