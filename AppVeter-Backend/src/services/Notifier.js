const clients = new Map();

function subscribe(userId, res) {
    const key = String(userId);
    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(res);

    res.on('close', () => {
        const set = clients.get(key);
        if (set) {
            set.delete(res);
            if (set.size === 0) clients.delete(key);
        }
    });
}

function notify(userId, payload) {
    const key = String(userId);
    const set = clients.get(key);
    if (!set) return;
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
        try {
            res.write(message);
        } catch (err) {
            set.delete(res);
        }
    }
}

module.exports = { subscribe, notify };
