const usersController = require('../controllers/UsersController');
const { createUpload } = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = createUpload('image');

module.exports = (app) => {
    app.post('/api/users/register', usersController.register);
    app.post('/api/users/register_with_image', upload.array('image', 1), usersController.registerWithImage);
    app.post('/api/users/login', usersController.login);
    app.post('/api/users/logout', usersController.logout);
    app.post('/api/users/forgot-password', usersController.forgotPassword);
    app.post('/api/users/verify-reset-code', usersController.verifyResetCode);
    app.post('/api/users/reset-password', usersController.resetPassword);

    app.get('/api/users/receptionists', authenticate, requireRole('ADMINISTRADOR'), usersController.getReceptionists);
    app.get('/api/users/veterinarians', authenticate, requireRole('ADMINISTRADOR'), usersController.getVeterinarians);
    app.get('/api/users/:id', authenticate, usersController.getProfile);
    app.put('/api/users/:id', authenticate, upload.array('image', 1), usersController.updateProfileWithImage);
    app.post('/api/users/register-receptionist', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), usersController.registerReceptionist);
    app.post('/api/users/register-veterinarian', authenticate, requireRole('ADMINISTRADOR'), upload.array('image', 1), usersController.registerVeterinarian);
    app.delete('/api/users/:id', authenticate, requireRole('ADMINISTRADOR'), usersController.deleteUser);
};
