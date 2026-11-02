// Configuración de la aplicación
// En desarrollo usa localhost, en producción usa la URL del backend en Render

window.__APP_CONFIG__ = {
    // URL del backend - Cambiar a la URL de Render cuando se despliegue
    API_URL: 'https://pets-products-backend.onrender.com/api',

    // Nombre de la aplicación
    APP_NAME: "Pet's Product's",

    // Versión
    VERSION: '1.1.0'
};

// Para compatibilidad con versiones anteriores
if (!window.__APPVETER_API__) {
    window.__APPVETER_API__ = window.__APP_CONFIG__.API_URL;
}