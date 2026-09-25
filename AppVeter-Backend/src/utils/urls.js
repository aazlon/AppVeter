function publicBaseUrl() {
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return base.replace(/\/+$/, '');
}

function uploadUrl(filename) {
    if (!filename) return null;
    if (/^https?:\/\//i.test(filename)) return filename;
    return `${publicBaseUrl()}/uploads/${filename.replace(/^\/+/, '')}`;
}

module.exports = { publicBaseUrl, uploadUrl };
