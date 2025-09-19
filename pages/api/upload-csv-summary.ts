import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import Papa from 'papaparse';
import { storage } from '../../lib/storage';

// Configuração Multer (memória)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 15 }
});

// Helpers
const isMonetaryValue = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  const t = val.trim();
  return /^R\$\s*[\d\.]{1,15},\d{2}$/.test(t) || /^R\$\s*\d+,\d{2}$/.test(t) || /^R\$\s*\d+$/.test(t);
};

const parseMonetary = (val: string): number => {
  let c = val.replace(/R\$|\s/g,'').trim();
  if (c.includes('.') && c.includes(',')) c = c.replace(/\./g,'').replace(',', '.');
  else if (c.includes(',')) c = c.replace(',', '.');
  return parseFloat(c) || 0;
};

const runMiddleware = (req: any, res: any, fn: any) => new Promise((resolve, reject) => {
  fn(req, res, (result: any) => {
    if (result instanceof Error) return reject(result);
    return resolve(result);
  });
});

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido' });

  try {
    await runMiddleware(req, res, upload.array('files', 15));
    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });

    const branches: Array<{ name: string; totalAPagar: number; totalAReceber: number; total: number }> = [];
    let grandTotalAPagar = 0;
    let grandTotalAReceber = 0;
    const globalDateTotals: Map<string, number> = new Map();
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

    for (const file of files) {
      const content = file.buffer.toString('utf-8');
      const { data } = Papa.parse(content, { header: false, delimiter: ';', skipEmptyLines: 'greedy' });
      const rows = data as any[];

      let branchName = file.originalname.replace(/\.(csv|CSV)$/,'').trim();
      if (rows[0] && rows[0][0]) {
        const firstCell = rows[0][0].toString().trim();
        if (firstCell) branchName = firstCell;
      }

      let totalAPagar = 0;
      let totalAReceber = 0;
      let currentSection: 'A_PAGAR' | 'A_RECEBER' | null = null;
      const branchDateTotals: Map<string, number> = new Map();

      for (const rawRow of rows) {
        if (!Array.isArray(rawRow)) continue;
        const row = [...rawRow];
        while (row.length && (row[row.length-1] === '' || row[row.length-1] == null)) row.pop();
        if (!row.length) continue;

        const upperJoin = row.map(c => (c||'').toString().toUpperCase()).join(' ');
        if (upperJoin.startsWith('CONTAS A PAGAR')) { currentSection = 'A_PAGAR'; continue; }
        if (upperJoin.startsWith('CONTAS A RECEBER')) { currentSection = 'A_RECEBER'; continue; }

        const normalizedCells = row.map(c => (c||'').toString().trim());
        const upperCells = normalizedCells.map(c => c.toUpperCase());

        if (upperCells.some(c => c.startsWith('TOTAL CONTAS A PAGAR'))) {
          const monetary = normalizedCells.find(c => c.includes('R$')) || normalizedCells[normalizedCells.length-1];
          if (monetary && isMonetaryValue(monetary)) totalAPagar = parseMonetary(monetary);
          continue;
        }
        if (upperCells.some(c => c.startsWith('TOTAL CONTAS A RECEBER'))) {
          const monetary = normalizedCells.find(c => c.includes('R$')) || normalizedCells[normalizedCells.length-1];
          if (monetary && isMonetaryValue(monetary)) totalAReceber = parseMonetary(monetary);
          continue;
        }

        // Ignorar subtotais parciais (linhas com apenas 'TOTAL' + valor) - detectamos se só há uma célula 'TOTAL'
        if (upperCells.filter(c => c === 'TOTAL').length === 1 && normalizedCells.length <= 5 && normalizedCells.some(c => c.includes('R$'))) {
          continue;
        }

        // Transações (A PAGAR) com data na primeira coluna
        const dateCell = normalizedCells[0];
        if (currentSection === 'A_PAGAR' && dateRegex.test(dateCell)) {
          const valueCell = normalizedCells[3]; // Vencimento;Transacionador;Documento;Valor
          if (valueCell && isMonetaryValue(valueCell)) {
            const valNum = parseMonetary(valueCell);
            if (valNum) {
              branchDateTotals.set(dateCell, (branchDateTotals.get(dateCell) || 0) + valNum);
              globalDateTotals.set(dateCell, (globalDateTotals.get(dateCell) || 0) + valNum);
            }
          }
        }
      }

      if (totalAPagar === 0 && branchDateTotals.size) {
        totalAPagar = Array.from(branchDateTotals.values()).reduce((a,b)=>a+b,0);
      }

      branches.push({ name: branchName, totalAPagar, totalAReceber, total: totalAPagar + totalAReceber });
      grandTotalAPagar += totalAPagar;
      grandTotalAReceber += totalAReceber;
    }

    const dateSpecificTotals = Array.from(globalDateTotals.entries())
      .map(([day,total]) => ({ day, total }))
      .sort((a,b) => {
        const pa = a.day.split('/');
        const pb = b.day.split('/');
        const da = new Date(parseInt(pa[2]), parseInt(pa[1])-1, parseInt(pa[0]));
        const db = new Date(parseInt(pb[2]), parseInt(pb[1])-1, parseInt(pb[0]));
        return da.getTime() - db.getTime();
      });

    const summaryData = {
      branches,
      grandTotal: grandTotalAPagar + grandTotalAReceber,
      grandTotalAPagar,
      grandTotalAReceber,
      dateSpecificTotals,
      generatedAt: new Date().toISOString()
    };

    console.log('[UPLOAD] Salvando summaryData no storage:', {
      branches: summaryData.branches.length,
      grandTotal: summaryData.grandTotal,
      dateSpecificTotals: summaryData.dateSpecificTotals.length
    });

    (storage as any)['summaryData'] = summaryData;
    
    console.log('[UPLOAD] Dados salvos no storage:', {
      branches: summaryData.branches.length,
      grandTotal: summaryData.grandTotal,
      dateSpecificTotals: Object.keys(summaryData.dateSpecificTotals || {}).length
    });
    console.log('[UPLOAD] Verificação de dados salvos:', !!(storage as any)['summaryData']);
    
    return res.status(200).json({ success: true, message: `${files.length} arquivo(s) processado(s) com sucesso`, data: summaryData });
  } catch (e: any) {
    console.error('Erro upload-csv-summary:', e);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
}