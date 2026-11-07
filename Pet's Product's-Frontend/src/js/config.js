

window.__APP_CONFIG__ = {

    API_URL: (function () {
        const hosts = ['localhost', '127.0.0.1', '[::1]'];
        const isLocal = typeof location !== 'undefined' &&
            (hosts.includes(location.hostname) || location.protocol === 'file:');
        return isLocal
            ? 'http://localhost:3000/api'
            : 'https://pets-products-backend.onrender.com/api';
    })(),


    APP_NAME: "Pet's Product's",


    VERSION: '1.1.0'
};


if (!window.__APPVETER_API__) {
    window.__APPVETER_API__ = window.__APP_CONFIG__.API_URL;
}