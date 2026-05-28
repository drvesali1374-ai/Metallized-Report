module.exports = {
  apps: [
    {
      name: 'pantask-backend',
      script: 'server/index.js',
      cwd: '/home/user/webapp',
      env: { NODE_ENV: 'development', PORT: 3001 },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'pantask-frontend',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: { NODE_ENV: 'development' },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
