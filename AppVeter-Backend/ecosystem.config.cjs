module.exports = {
    apps: [
        {
            name: 'appveter-api',
            script: 'Server.js',
            instances: process.env.PM2_INSTANCES || 'max',
            exec_mode: 'cluster',
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            merge_logs: true,
            time: true
        }
    ]
};
