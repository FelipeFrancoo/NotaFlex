import fs from 'fs';
import path from 'path';

export function parseContasAPagarCsv(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Arquivo não encontrado: ${abs}`);
  }
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const targetPrefix = 'Contas a pagar- À vencer';
  const registros = [];
  for (const line of lines) {
    if (!line.startsWith(targetPrefix + ',')) continue;
    const fields = tokenizeCsvLine(line);
    if (fields.length < 6) continue;
    const [, data1, transacionador, documento, , valorRaw] = fields;
    if (/^Total \d{2}\/\d{2}\/\d{4}:/.test(transacionador)) continue;
    registros.push({
      Vencimento: data1.trim(),
      Transacionador: transacionador.trim(),
      Documento: documento.trim(),
      Valor: valorRaw.replace(/^"|"$/g, '').trim(),
    });
  }
  return registros;
}

function tokenizeCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.error('Uso: node lib/parseContasAPagar.js <arquivo.csv>');
    process.exit(1);
  }
  console.log(JSON.stringify(parseContasAPagarCsv(target), null, 2));
}
