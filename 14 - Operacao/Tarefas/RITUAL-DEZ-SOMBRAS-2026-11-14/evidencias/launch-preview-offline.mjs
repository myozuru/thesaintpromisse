import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const env = {
  ...process.env,
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_DEZ_SOMBRAS_QA: '',
};

console.log(`Prévia local offline de ${projectRoot} em http://127.0.0.1:5183/`);
const vite = spawn(process.execPath, [viteBin, 'dev', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

vite.on('error', error => {
  console.error('Falha ao iniciar a prévia local:', error);
  process.exitCode = 1;
});
vite.on('close', code => {
  process.exitCode = code ?? 1;
});
