const notificacionController = require('../controllers/NotificacionController');
const { authenticate } = require('../middleware/auth');

module.exports = (app) => {
    app.post('/api/notificaciones/create', authenticate, notificacionController.createNotificacion);
    app.get('/api/notificaciones/stream', authenticate, notificacionController.stream);
    app.get('/api/notificaciones/user/:userId', authenticate, notificacionController.getNotificacionesByUserId);
    app.put('/api/notificaciones/:id/read', authenticate, notificacionController.markNotificacionAsRead);
    app.put('/api/notificaciones/user/:userId/read-all', authenticate, notificacionController.markAllAsRead);
    app.get('/api/notificaciones/user/:userId/unread-count', authenticate, notificacionController.getUnreadCount);
    app.delete('/api/notificaciones/:id', authenticate, notificacionController.deleteNotificacion);
};
