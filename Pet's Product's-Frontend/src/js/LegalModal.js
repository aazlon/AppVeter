let initialized = false;

const SECTIONS = {
    privacy: {
        title: '<i class="fas fa-user-shield"></i> Política de Privacidad',
        body: `
            <h3>1. Introducción</h3>
            <p>
                Pets Products 2022 C.A (en adelante, "la Empresa", "nosotros" o "nuestro") es responsable del tratamiento
                de los datos personales recabados a través de esta plataforma web y se compromete a proteger la
                privacidad de sus usuarios. La presente Política de Privacidad describe qué información personal
                recopilamos, con qué finalidad la utilizamos, cómo la almacenamos y protegemos, y qué derechos
                usted puede ejercer sobre sus datos.
            </p>
            <p>
                Al utilizar la plataforma y crear una cuenta, usted declara haber leído y aceptado esta Política de
                Privacidad. Si no está de acuerdo con alguna de sus condiciones, le solicitamos no hacer uso de
                nuestros servicios.
            </p>

            <h3>2. Datos personales que recopilamos</h3>
            <p>De conformidad con el principio de minimización de datos, solo recopilamos la información necesaria para prestar el servicio:</p>
            <ul>
                <li><strong>Datos de identificación y contacto:</strong> nombre, apellido, nombre de usuario, correo electrónico, cédula de identidad y número de teléfono.</li>
                <li><strong>Datos de la cuenta:</strong> contraseña, almacenada de forma protegida en nuestros sistemas.</li>
                <li><strong>Datos de las mascotas:</strong> nombre, especie, raza, edad, sexo, peso, dieta, número de microchip e información clínica (historia clínica, signos vitales y antecedentes relevantes).</li>
                <li><strong>Datos de las citas:</strong> motivo de la solicitud, fecha, estado de la cita y datos del propietario (dirección, teléfono y correo electrónico).</li>
                <li><strong>Contenido de notificaciones y novedades</strong> generadas dentro de la plataforma.</li>
                <li><strong>Datos técnicos de sesión:</strong> información necesaria para mantener su sesión activa, almacenada localmente en su navegador.</li>
            </ul>

            <h3>3. Finalidades del tratamiento</h3>
            <p>Tratamos sus datos personales para las siguientes finalidades:</p>
            <ul>
                <li>Gestionar su registro, acceso y autenticación en la plataforma.</li>
                <li>Programar, aprobar, rechazar y administrar las citas veterinarias solicitadas.</li>
                <li>Consultar y actualizar la historia clínica de sus mascotas.</li>
                <li>Enviar notificaciones relacionadas con sus citas y con las novedades de la clínica.</li>
                <li>Brindar soporte técnico y atender sus consultas.</li>
                <li>Cumplir con obligaciones legales, contables y normativas aplicables.</li>
            </ul>

            <h3>4. Base legal del tratamiento</h3>
            <p>
                El tratamiento de sus datos se sustenta en su consentimiento, otorgado libremente al registrarse y
                utilizar la plataforma, y en la necesidad de ejecutar el contrato de prestación de servicios
                veterinarios solicitados a través de la misma. Usted puede retirar su consentimiento en cualquier
                momento, sin que ello afecte la licitud del tratamiento previo ni la prestación de los servicios
                contratados.
            </p>

            <h3>5. Conservación de los datos</h3>
            <p>
                Sus datos se conservarán mientras su cuenta permanezca activa o mientras sean necesarios para
                cumplir con las finalidades descritas en esta política. Finalizada la relación, ciertos datos
                (por ejemplo, registros clínicos o contables) podrán mantenerse por los plazos que exija la ley.
                Transcurridos dichos plazos, la información será eliminada o anonimizada de forma segura.
            </p>

            <h3>6. Compartición y transferencia de datos</h3>
            <p>No vendemos, alquilamos ni comercializamos sus datos personales con terceros. Solo podrán acceder a su información:</p>
            <ul>
                <li>El personal autorizado de la clínica (recepcionistas y veterinarios), en el marco de sus funciones y con deber de confidencialidad.</li>
                <li>Proveedores técnicos que alojan o mantienen la plataforma, sujetos a obligaciones contractuales de protección de datos.</li>
                <li>Autoridades competentes, cuando el tratamiento sea requerido por ley o por orden judicial.</li>
            </ul>

            <h3>7. Seguridad de la información</h3>
            <p>
                Adoptamos medidas técnicas y organizativas razonables para proteger sus datos contra el acceso no
                autorizado, la alteración, la divulgación o la destrucción, tales como el restringido control de
                acceso al sistema y el cifrado de las contraseñas. Ningún sistema es infalible; en caso de
                producirse una brecha de seguridad que afecte sus derechos, lo notificaremos en la mayor
                brevedad posible.
            </p>

            <h3>8. Almacenamiento local y cookies</h3>
            <p>
                La plataforma utiliza el almacenamiento local del navegador (localStorage) para mantener su sesión
                iniciada y recordar sus preferencias de navegación. No utilizamos cookies de rastreo con fines
                publicitarios ni compartimos información de navegación con terceros con fines comerciales. Puede
                eliminar estos datos en cualquier momento desde la configuración de su navegador o cerrando
                sesión en la aplicación.
            </p>

            <h3>9. Derechos de los titulares</h3>
            <p>
                De conformidad con la Ley Orgánica de Protección de Datos Personales de la República Bolivariana de
                Venezuela, usted tiene derecho a:
            </p>
            <ul>
                <li><strong>Acceso:</strong> conocer qué datos personales suyos tratamos.</li>
                <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
                <li><strong>Oposición:</strong> oponerse a tratamientos determinados.</li>
                <li><strong>Revocación del consentimiento:</strong> retirar en cualquier momento el otorgado.</li>
            </ul>
            <p>
                Para ejercer estos derechos puede actualizar sus datos desde la sección de perfil de la aplicación
                o dirigir su solicitud a través de los canales oficiales de contacto indicados en el apartado 12,
                acreditando su identidad.
            </p>

            <h3>10. Menores de edad</h3>
            <p>
                El uso de la plataforma está dirigido exclusivamente a mayores de dieciocho (18) años. Si
                detectamos que un menor de edad ha facilitado datos personales sin la intervención de su
                representante legal, procederemos a su eliminación.
            </p>

            <h3>11. Cambios a esta política</h3>
            <p>
                Podemos modificar esta Política de Privacidad para adaptarla a novedades legislativas, técnicas o
                de servicio. Cualquier cambio será publicado en esta misma sección, indicando la fecha de última
                actualización. Le recomendamos revisarla periódicamente. El uso continuo de la plataforma tras la
                publicación de los cambios implicará la aceptación de los mismos.
            </p>

            <h3>12. Contacto</h3>
            <p>
                Si tiene preguntas, dudas o desea ejercer sus derechos sobre sus datos personales, puede
                comunicarse con nosotros a través de los canales oficiales de la clínica o de nuestra cuenta de
                Instagram
                <a href="https://www.instagram.com/pets.products2022/" target="_blank" rel="noopener noreferrer">@pets.products2022</a>.
            </p>

            <p class="legal-updated"><strong>Última actualización:</strong> 23 de septiembre de 2026.</p>
        `
    },
    terms: {
        title: '<i class="fas fa-file-contract"></i> Términos y Condiciones',
        body: `
            <h3>1. Aceptación de los Términos</h3>
            <p>
                Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma web de Pets Products
                2022 C.A (en adelante, "la Empresa" o "nosotros"). Al acceder, registrarse o utilizar la
                plataforma, usted declara haber leído, comprendido y aceptado estos términos en su totalidad. Si
                no está de acuerdo con alguna disposición, le rogamos no utilizar el servicio.
            </p>

            <h3>2. Descripción del servicio</h3>
            <p>
                La plataforma es una herramienta de gestión que permite, entre otras funciones: el registro de
                usuarios, el agendamiento y administración de citas veterinarias, la consulta y actualización de
                historias clínicas de mascotas, y la recepción de notificaciones y novedades de la clínica.
            </p>
            <p>
                La plataforma constituye un canal de gestión y comunicación; <strong>no sustituye en ningún caso la
                valoración, diagnóstico o tratamiento veterinario presencial</strong>, ni constituye por sí misma
                una consulta médica veterinaria.
            </p>

            <h3>3. Registro y cuenta de usuario</h3>
            <ul>
                <li>El usuario se obliga a proporcionar información veraz, completa y a mantenerla actualizada.</li>
                <li>La cuenta es personal e intransferible; el usuario es responsable de toda actividad realizada con sus credenciales.</li>
                <li>El usuario debe mantener la confidencialidad de su contraseña y notificar de inmediato cualquier uso no autorizado.</li>
                <li>La Empresa podrá suspender o eliminar las cuentas que contengan información falsa, incompleta o que violen estos términos.</li>
            </ul>

            <h3>4. Obligaciones y uso aceptable</h3>
            <p>El usuario se compromete a utilizar la plataforma de forma lícita y conforme a la buena fe. Queda expresamente prohibido:</p>
            <ul>
                <li>Intentar acceder a datos de otros usuarios o a áreas restringidas del sistema.</li>
                <li>Interferir, interrumpir o degradar el funcionamiento de la plataforma.</li>
                <li>Introducir virus, malware o cualquier código destinado a dañar o alterar el sistema.</li>
                <li>Utilizar la plataforma para difundir contenido ilícito, ofensivo o que atente contra derechos de terceros.</li>
                <li>Reproducir, copiar o explotar el contenido de la plataforma sin autorización expresa.</li>
            </ul>

            <h3>5. Citas y servicios veterinarios</h3>
            <ul>
                <li>La solicitud de una cita a través de la plataforma no implica su confirmación automática; toda cita debe ser aprobada por el personal de la clínica, quien asignará la fecha correspondiente.</li>
                <li>La clínica podrá rechazar o reprogramar citas por causas justificadas, notificando al usuario a través de la plataforma.</li>
                <li>El usuario es responsable de asistir a las citas aprobadas y de proporcionar la información necesaria para la atención de su mascota.</li>
                <li>La información clínica y los consejos mostrados en la plataforma tienen carácter informativo y no reemplazan la consulta con un profesional veterinario habilitado.</li>
            </ul>

            <h3>6. Propiedad intelectual</h3>
            <p>
                Todos los contenidos de la plataforma —incluyendo diseño, logotipos, marcas, textos, imágenes,
                código fuente y estructura— son propiedad de Pets Products 2022 C.A o de sus respectivos
                licenciantes y están protegidos por la legislación aplicable en materia de propiedad intelectual.
                Queda prohibida su reproducción, distribución o transformación sin autorización previa y por
                escrito del titular.
            </p>

            <h3>7. Limitación de responsabilidad</h3>
            <ul>
                <li>La Empresa no será responsable por interrupciones, errores o daños derivados de fallas de internet, mantenimiento del sistema, uso indebido de la plataforma o fuerza mayor.</li>
                <li>Las decisiones clínicas adoptadas por los profesionales veterinarios son de su exclusiva responsabilidad profesional, dentro del marco de la atención presencial.</li>
                <li>El usuario es responsable del equipo y de la conexión desde los cuales accede al servicio.</li>
                <li>La Empresa no garantiza la disponibilidad ininterrumpida de la plataforma, aunque procurará mantenerla operativa de manera razonable.</li>
            </ul>

            <h3>8. Enlaces a sitios de terceros</h3>
            <p>
                La plataforma puede incluir enlaces a perfiles de redes sociales (como Instagram). dichos enlaces
                se ofrecen únicamente como referencia; la Empresa no controla ni se responsabiliza por el
                contenido, las políticas o las prácticas de dichos sitios de terceros, los cuales se rigen por sus
                propios términos y políticas de privacidad.
            </p>

            <h3>9. Modificaciones</h3>
            <p>
                La Empresa se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento.
                Las modificaciones serán publicadas en esta misma sección e indicarán su fecha de actualización.
                El uso continuo de la plataforma tras la entrada en vigor de los cambios implicará su aceptación.
            </p>

            <h3>10. Ley aplicable y jurisdicción</h3>
            <p>
                Estos Términos y Condiciones se rigen por las leyes de la República Bolivariana de Venezuela.
                Cualquier controversia derivada del uso de la plataforma será sometida a los tribunales
                competentes de la jurisdicción correspondiente, salvo que la normativa aplicable establezca un
                fuero imperativo distinto en favor del consumidor o usuario.
            </p>

            <h3>11. Contacto</h3>
            <p>
                Para cualquier consulta relacionada con estos términos, puede comunicarse con nosotros a través de
                los canales oficiales de la clínica o de nuestra cuenta de Instagram
                <a href="https://www.instagram.com/pets.products2022/" target="_blank" rel="noopener noreferrer">@pets.products2022</a>.
            </p>

            <p class="legal-updated"><strong>Última actualización:</strong> 23 de septiembre de 2026.</p>
        `
    }
};

function ensureStylesheet() {
    if (document.querySelector('link[href*="LegalModal.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../css/LegalModal.css', import.meta.url).href;
    document.head.appendChild(link);
}

function ensureModal() {
    if (document.getElementById('legal-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div class="legal-modal" id="legal-modal">
            <div class="legal-modal-content">
                <div class="legal-modal-header">
                    <h2 id="legal-modal-title"></h2>
                    <button type="button" class="legal-modal-close" id="legal-modal-close" aria-label="Cerrar">&times;</button>
                </div>
                <div class="legal-modal-body" id="legal-modal-body"></div>
                <div class="legal-modal-footer">
                    <button type="button" class="legal-modal-btn" id="legal-modal-ok">Cerrar</button>
                </div>
            </div>
        </div>
    `);

    const modal = document.getElementById('legal-modal');
    document.getElementById('legal-modal-close').addEventListener('click', closeLegalModal);
    document.getElementById('legal-modal-ok').addEventListener('click', closeLegalModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLegalModal();
    });
}

export function initLegalModal() {
    ensureStylesheet();
    ensureModal();

    if (initialized) return;
    initialized = true;

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-legal]');
        if (!trigger) return;
        e.preventDefault();
        openLegalSection(trigger.dataset.legal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLegalModal();
    });
}

export function openLegalSection(key) {
    const section = SECTIONS[key];
    if (!section) return;

    const modal = document.getElementById('legal-modal');
    const title = document.getElementById('legal-modal-title');
    const body = document.getElementById('legal-modal-body');
    if (!modal || !title || !body) return;

    title.innerHTML = section.title;
    body.innerHTML = section.body;
    body.scrollTop = 0;
    modal.classList.add('active');
}

export function closeLegalModal() {
    const modal = document.getElementById('legal-modal');
    if (modal) modal.classList.remove('active');
}
