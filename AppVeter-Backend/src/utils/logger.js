const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: undefined
});

module.exports = logger;
