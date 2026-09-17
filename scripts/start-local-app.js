/*
 * Development entry point for Otu-Zan.
 *
 * Authentication depends on the Laravel API, so React must never be launched
 * on its own during local development.  Start and verify the API first, then
 * hand control to react-scripts.
 */
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const backendLauncher = path.join(root, 'scripts', 'start-local-backend.js');
const reactStart = path.join(root, 'node_modules', 'react-scripts', 'scripts', 'start.js');

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code) => code === 0
    ? resolve()
    : reject(new Error(`Startup command exited with code ${code}.`)));
});

const startFrontend = () => {
  const child = spawn(node, [reactStart], { cwd: root, stdio: 'inherit', windowsHide: true });
  child.once('error', (error) => {
    console.error(`Unable to start the frontend: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code) => { process.exitCode = code ?? 0; });
  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => child.kill(signal)));
};

run(node, [backendLauncher])
  .then(startFrontend)
  .catch((error) => {
    console.error(`Otu-Zan was not started: ${error.message}`);
    console.error('Start Apache and MySQL in XAMPP, then run npm start again.');
    process.exitCode = 1;
  });
