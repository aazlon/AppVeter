const veterinaryController = require('../controllers/VeterinaryController');
const { authenticate, requireRole } = require('../middleware/auth');

module.exports = (app) => {
    app.get('/api/veterinary/doctors', authenticate, veterinaryController.getDoctors);
    app.get('/api/veterinary/records', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'VETERINARIO'), veterinaryController.getHistories);
    app.post('/api/veterinary/register', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'VETERINARIO'), veterinaryController.registerHistory);
    app.put('/api/veterinary/records/:id', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'VETERINARIO'), veterinaryController.updateHistory);
    app.delete('/api/veterinary/records/:id', authenticate, requireRole('ADMINISTRADOR', 'RECEPCIONISTA', 'VETERINARIO'), veterinaryController.deleteHistory);
};
