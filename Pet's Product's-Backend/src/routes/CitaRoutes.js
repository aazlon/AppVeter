const citaController = require('../controllers/CitaController');
const { authenticate, requireRole } = require('../middleware/auth');

module.exports = (app) => {
    app.post('/api/citas/create', authenticate, citaController.createCita);
    app.get('/api/citas/all', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA'), citaController.getAllCitas);
    app.get('/api/citas/pending', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA'), citaController.getAllPending);
    app.get('/api/citas/:id', authenticate, citaController.getCitaById);
    app.put('/api/citas/:id/status', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA'), citaController.updateCitaStatus);
    app.put('/api/citas/:id/date', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA'), citaController.updateCitaDate);
    app.get('/api/citas/user/:userId', authenticate, citaController.getCitasByUserId);
};
