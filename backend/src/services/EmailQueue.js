const queue = [];
let working = false;

async function processNext() {
    if (working) return;
    const job = queue.shift();
    if (!job) return;
    working = true;
    try {
        await job();
    } catch (err) {
        console.error('Error en job de email:', err && err.message ? err.message : err);
    } finally {
        working = false;
        setImmediate(processNext);
    }
}

function enqueue(job) {
    queue.push(job);
    if (queue.length > 500) {
        queue.shift();
    }
    processNext();
}

function enqueueEmail(sendFn) {
    return new Promise((resolve, reject) => {
        enqueue(async () => {
            try {
                await sendFn();
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    });
}

module.exports = { enqueue, enqueueEmail };
