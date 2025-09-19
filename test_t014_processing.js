const fs = require('fs');
const path = require('path');
const { parseCSV, extractPayables } = require('./extract_data');

// Simple manual test runner
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK  :', msg);
  }
}

function loadSample() {
  // Pick a sample CSV that contains the section
  const file = path.join(__dirname, 'attached_assets', 'T014_VisaoGeralFluxoCaixaDetalhado (1) (3)_1756494215537.csv');
  const content = fs.readFileSync(file, 'utf8');
  return parseCSV(content);
}

function testExtraction() {
  const rows = loadSample();
  const data = extractPayables(rows);
  console.log('Extracted items:', data.length);
  // Basic expectations
  assert(data.length > 0, 'Should extract at least one payable line');
  // Check mapping keys
  const first = data[0];
  assert('Vencimento' in first, 'Contains Vencimento');
  assert('Transacionador' in first, 'Contains Transacionador');
  assert('Documento' in first, 'Contains Documento');
  assert('Valor' in first, 'Contains Valor');
  // Ensure we did not pick a total line
  const hasTotal = data.some(d => /Total/i.test(d.Transacionador) || /Total/i.test(d.Documento));
  assert(!hasTotal, 'No total lines included');
}

if (require.main === module) {
  testExtraction();
}
