import * as fs from 'fs';
import * as path from 'path';

export interface ContasAPagarRegistro {
  Vencimento: string; // from DATA1
  Transacionador: string; // from TRANSACIONADOR
  Documento: string; // from DOCUMENTO
  Valor: string; // raw currency text e.g. R$3.200,00 (keep formatting)
}

/**
 * Parses a CSV export locating the section that starts with the header line preceding
 * the data rows of interest. We search for the first data row that begins with
 * 'Contas a pagar- À vencer,' and then continue while subsequent lines also start with that prefix.
 * Lines containing daily totals (pattern: ',Total dd/mm/YYYY:') are ignored; only the literal
 * first five comma-delimited fields (up to VALOR) are considered.
 */
export function parseContasAPagarCsv(filePath: string): ContasAPagarRegistro[] {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Arquivo não encontrado: ${abs}`);
  }
  const content = fs.readFileSync(abs, 'utf8');

  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  const targetPrefix = 'Contas a pagar- À vencer';
  const registros: ContasAPagarRegistro[] = [];

  for (const line of lines) {
    if (!line.startsWith(targetPrefix + ',')) continue;

    // Split only first 6 CSV logical fields (before the extra total columns).
    // We cannot naive-split by comma because description field can have commas inside quotes.
    // We'll implement a small CSV tokenizer for this line.
    const fields = tokenizeCsvLine(line);
    // Expected order (from sample):
    // 0: Contas a pagar- À vencer
    // 1: DATA1 (date)
    // 2: TRANSACIONADOR
    // 3: DOCUMENTO
    // 4: T014_Observacao (ignored)
    // 5: VALOR (currency) e.g. R$3.200,00 possibly quoted
    if (fields.length < 6) {
      continue; // malformed line, skip silently
    }
    const [/*tipo*/, data1, transacionador, documento, /*obs*/, valorRaw] = fields;

    // Ignore if it's actually a total line (should not be because totals appear later fields) but guard anyway
    if (/^Total \d{2}\/\d{2}\/\d{4}:/.test(transacionador)) {
      continue;
    }

    registros.push({
      Vencimento: data1.trim(),
      Transacionador: transacionador.trim(),
      Documento: documento.trim(),
      Valor: valorRaw.replace(/^"|"$/g, '').trim(),
    });
  }

  return registros;
}

// Minimal CSV tokenizer handling quotes and embedded commas
function tokenizeCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { // escaped quote
        current += '"';
        i++; // skip next
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

if (require.main === module) {
  // Allow running directly: ts-node lib/parseContasAPagar.ts <arquivo.csv>
  const target = process.argv[2];
  if (!target) {
    console.error('Uso: ts-node lib/parseContasAPagar.ts <arquivo.csv>');
    process.exit(1);
  }
  const data = parseContasAPagarCsv(target);
  console.log(JSON.stringify(data, null, 2));
}
