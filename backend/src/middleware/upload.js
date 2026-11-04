const multer = require('multer');
const path = require('path');

// Los archivos subidos se procesan en memoria: se persisten como data URL base64
// en la base de datos, no en disco (el disco de Render Free es efímero).
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXTENSION_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};
const ALLOWED_EXTENSIONS = Object.values(EXTENSION_BY_MIME);
const MAX_SIZE = Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024;

function createUpload() {
    return multer({
        storage: multer.memoryStorage(),
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

// Convierte el archivo subido (buffer en memoria) en data URL base64 para persistirlo en BD.
function imageToDataUrl(file) {
    if (!file || !file.buffer) return null;
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

module.exports = { createUpload, imageToDataUrl, ALLOWED_MIMETYPES, ALLOWED_EXTENSIONS, MAX_SIZE };
