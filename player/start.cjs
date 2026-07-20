const { spawn } = require('child_process')
const path = require('path')

const vite = spawn('node', [
  path.join(__dirname, 'node_modules/vite/bin/vite.js'),
  'preview', '--port', '5176', '--host'
], {
  cwd: __dirname,
  stdio: 'inherit'
})

vite.on('error', (err) => console.error(err))
