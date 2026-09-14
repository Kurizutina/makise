// Laravel launcher. Start Apache and MySQL in XAMPP for phpMyAdmin/database access.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'laravel');
const php = process.env.PHP_BINARY || (fs.existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const commands = { '--check': ['otuzan:db-check'], '--migrate': ['migrate'], '--test': ['test'] };

const run = (args) => {
  const result = spawnSync(php, ['artisan', ...args], { cwd: backend, stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
};

(async () => {
  if (!fs.existsSync(path.join(backend, '.env')) || !fs.existsSync(path.join(backend, 'vendor/autoload.php'))) {
    throw new Error('Configure laravel/.env and install Composer dependencies first. See README.md.');
  }
  const command = commands[process.argv[2]];
  if (command) { process.exitCode = run(command); return; }
  const check = run(['otuzan:db-check']);
  if (check) throw new Error('Database unavailable. Start MySQL in XAMPP and check laravel/.env.');
  const args = ['serve', '--host=localhost', '--port=5000', '--tries=1'];
  if (process.argv.includes('--foreground')) { process.exitCode = run(args); return; }
  const health = async () => {
    const response = await fetch('http://localhost:5000/api/health/db', { signal: AbortSignal.timeout(2000) });
    const body = await response.json();
    if (!response.ok || body.backend !== 'laravel' || body.status !== 'connected') {
      throw new Error('Port 5000 is occupied or Laravel is unhealthy. Check .local/laravel.log.');
    }
  };
  try { await health(); }
  catch (error) {
    if (error.cause?.code !== 'ECONNREFUSED') throw error;
    const local = path.join(root, '.local');
    fs.mkdirSync(local, { recursive: true });
    const log = fs.openSync(path.join(local, 'laravel.log'), 'a');
    try {
      const child = spawn(php, ['artisan', ...args], {
        cwd: backend, detached: true, windowsHide: true, stdio: ['ignore', log, log]
      });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
    } finally { fs.closeSync(log); }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { await health(); break; }
      catch (error) {
        if (attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  console.log('Laravel ready at http://localhost:5000. phpMyAdmin: http://localhost/phpmyadmin');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
