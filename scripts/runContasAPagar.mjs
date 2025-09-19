import { parseContasAPagarCsv } from '../lib/parseContasAPagar.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Allow running with: node scripts/runContasAPagar.mjs <arquivo.csv>
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2];
if (!target) {
  console.error('Uso: node scripts/runContasAPagar.mjs <arquivo.csv>');
  process.exit(1);
}

// Support relative path from project root
const full = path.isAbsolute(target) ? target : path.resolve(__dirname, '..', target);
try {
  const data = parseContasAPagarCsv(full);
  console.log(JSON.stringify(data, null, 2));
} catch (e) {
  console.error('Erro ao processar arquivo:', e instanceof Error ? e.message : e);
  process.exit(1);
}
