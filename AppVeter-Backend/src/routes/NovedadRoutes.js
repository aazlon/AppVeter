const novedadController = require('../controllers/NovedadController');
const { createUpload } = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = createUpload('novedad');

module.exports = (app) => {
    app.get('/api/novedades', novedadController.getAll);
    app.get('/api/novedades/:id', novedadController.getById);

    app.post('/api/novedades', authenticate, requireRole('ADMINISTRADOR'), novedadController.create);
    app.post('/api/novedades/with-image', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), novedadController.createWithImage);
    app.put('/api/novedades/:id', authenticate, requireRole('ADMINISTRADOR'), novedadController.update);
    app.put('/api/novedades/:id/with-image', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), novedadController.updateWithImage);
    app.delete('/api/novedades/:id', authenticate, requireRole('ADMINISTRADOR'), novedadController.delete);
};
