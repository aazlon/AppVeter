const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXTENSION_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};
const ALLOWED_EXTENSIONS = Object.values(EXTENSION_BY_MIME);
const MAX_SIZE = Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024;

function createUpload(prefix) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = EXTENSION_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                const err = new Error('Extensión de archivo no permitida.');
                err.status = 400;
                return cb(err);
            }
            const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '');
            cb(null, `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        }
    });

    return multer({
        storage,
        limits: { fileSize: MAX_SIZE, files: 1 },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            if (!ALLOWED_MIMETYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
                const err = new Error('Tipo de archivo no permitido. Solo se admiten imágenes (jpg, png, webp, gif).');
                err.status = 400;
                return cb(err);
            }
            cb(null, true);
        }
    });
}

module.exports = { createUpload, uploadDir, ALLOWED_MIMETYPES, ALLOWED_EXTENSIONS, MAX_SIZE };
