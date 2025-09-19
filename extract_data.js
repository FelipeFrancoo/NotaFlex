#!/usr/bin/env node
/**
 * Extrai a seção "Contas a pagar- À vencer" de um arquivo CSV exportado.
 * Requisitos:
 * 1. Localizar a primeira linha que contenha exatamente o texto de seção (primeira coluna) "Contas a pagar- À vencer".
 * 2. Identificar colunas: DATA1 (ou DATA6), TRANSACIONADOR (ou TRANSACIONADOR6), DOCUMENTO (ou DOCUMENTO4) e VALOR (ou VALOR3).
 *    Como o arquivo possui cabeçalhos diferentes (Textbox86,DATA6,TRANSACIONADOR6,...) vamos:
 *      - Ler o cabeçalho imediatamente anterior às linhas da seção alvo e mapear possíveis nomes alternativos.
 * 3. Extrair linhas enquanto a primeira coluna for "Contas a pagar- À vencer".
 * 4. Ignorar colunas de totais diários (começam com "Total dd/mm/aaaa:" em alguma coluna posterior) e apenas capturar os valores unitários.
 * 5. Produzir um array de objetos: { Vencimento, Transacionador, Documento, Valor }
 */

const fs = require('fs');
const path = require('path');

function parseCSV(content) {
	// Split preserving empty fields. Lines may have quoted commas.
	// We'll do a simple state machine for quotes.
	const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
	return lines.map(line => splitCSVLine(line));
}

function splitCSVLine(line) {
	const result = [];
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
		} else {
			current += ch;
		}
	}
	result.push(current);
	return result.map(v => v.trim());
}

function normalizeMoney(str) {
	if (!str) return null;
	// Expect formats like R$1.234.567,89 or R$ 1.234,56
	const cleaned = str.replace(/R\$\s?/i, '').replace(/\./g, '').replace(/,/g, '.').replace(/"/g, '').trim();
	const num = parseFloat(cleaned);
	return isNaN(num) ? null : num;
}

function extractPayables(rows) {
	// Find header that precedes the first row whose first cell equals 'Contas a pagar- À vencer'
	const targetLabel = 'Contas a pagar- À vencer';
	let headerRowIndex = -1;
	let firstDataIndex = -1;
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		if (r[0] === targetLabel) {
			// Walk backwards to find a likely header (line containing DATA or TRANSACIONADOR tokens)
			for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
				const possible = rows[j];
				if (possible.some(c => /DATA\d*/i.test(c)) && possible.some(c => /TRANSACIONADOR/i.test(c))) {
					headerRowIndex = j;
					break;
				}
			}
			firstDataIndex = i;
			break;
		}
	}
	if (firstDataIndex === -1) return [];

	const header = headerRowIndex !== -1 ? rows[headerRowIndex] : [];
	// Map column indices
	const colMap = {};
	for (let idx = 0; idx < header.length; idx++) {
		const name = header[idx];
		if (/^DATA\d*$/i.test(name)) colMap.date = idx;
		else if (/^TRANSACIONADOR\d*$/i.test(name)) colMap.trans = idx;
		else if (/^DOCUMENTO\d*$/i.test(name)) colMap.doc = idx;
		else if (/^VALOR\d*$/i.test(name)) {
			// Keep first VALOR (not VALOR1X etc). We'll prefer the earliest meaningful one after doc.
			if (colMap.valor == null) colMap.valor = idx;
		}
	}
	// Fallback: try to detect by relative positions from first data line if missing
	if (colMap.date == null || colMap.trans == null || colMap.doc == null || colMap.valor == null) {
		const sample = rows[firstDataIndex];
		// Heuristic: structure: [label, date, transacionador, documento, (obs), valor, ...]
		if (sample.length >= 6) {
			if (colMap.date == null) colMap.date = 1;
			if (colMap.trans == null) colMap.trans = 2;
			if (colMap.doc == null) colMap.doc = 3;
			if (colMap.valor == null) colMap.valor = 5; // after optional obs
		}
	}

	const results = [];
	for (let i = firstDataIndex; i < rows.length; i++) {
		const r = rows[i];
		if (r[0] !== targetLabel) break; // Stop when section ends
		const date = r[colMap.date] || '';
		const trans = r[colMap.trans] || '';
		const doc = r[colMap.doc] || '';
		const valorRaw = r[colMap.valor] || '';
		// Skip if this line appears to be an aggregate only (e.g., doc empty and valor empty)
		if (!trans && !doc) continue;
		// Value normalization but keep original string too if needed
		const valorNumber = normalizeMoney(valorRaw);
		results.push({
			Vencimento: date,
			Transacionador: trans,
			Documento: doc,
			Valor: valorRaw.replace(/"/g, ''),
			ValorNumber: valorNumber
		});
	}
	return results;
}

function main() {
	const file = process.argv[2];
	if (!file) {
		console.error('Uso: node extract_data.js <arquivo.csv>');
		process.exit(1);
	}
	const full = path.resolve(process.cwd(), file);
	if (!fs.existsSync(full)) {
		console.error('Arquivo não encontrado:', full);
		process.exit(1);
	}
	const content = fs.readFileSync(full, 'utf8');
	const rows = parseCSV(content);
	const data = extractPayables(rows);
	console.log(JSON.stringify(data, null, 2));
}

if (require.main === module) {
	main();
}

module.exports = { parseCSV, extractPayables };
