const serviceController = require('../controllers/ServiceController');
const { createUpload } = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = createUpload('service');

module.exports = (app) => {
    app.get('/api/services', serviceController.getAll);
    app.get('/api/services/:id', serviceController.getById);

    app.post('/api/services', authenticate, requireRole('ADMINISTRADOR'), serviceController.create);
    app.post('/api/services/with-image', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), serviceController.createWithImage);
    app.put('/api/services/:id', authenticate, requireRole('ADMINISTRADOR'), serviceController.update);
    app.put('/api/services/:id/with-image', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), serviceController.updateWithImage);
    app.delete('/api/services/:id', authenticate, requireRole('ADMINISTRADOR'), serviceController.delete);
};
