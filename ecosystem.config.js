module.exports = {
  apps: [{
    name: 'agenda-api',
    script: './dist/server.js',
    interpreter: 'bun',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
