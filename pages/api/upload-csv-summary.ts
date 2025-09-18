import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import Papa from 'papaparse'

// Interface para dados de resumo
interface SummaryData {
  branches: Array<{
    name: string;
    totalAPagar: number;
    totalAReceber: number;
    total: number;
  }>;
  dateSpecificTotals: Array<{ day: string; total: number }>;
  grandTotal: number;
  grandTotalAPagar: number;
  grandTotalAReceber: number;
}

// Função para identificar valores monetários
function isMonetaryValue(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  
  const patterns = [
    /^R\$\s*[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/, // R$ 1.234.567,89
    /^[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/, // 1.234.567,89
    /^[\d]+,[\d]{2}$/, // 12345,89
    /^R\$\s*[\d.,]+$/, // R$ com vários formatos
  ];
  
  return patterns.some(pattern => pattern.test(trimmed)) || 
         (/\d/.test(trimmed) && /[R$,.]/.test(trimmed) && trimmed.length <= 20);
}

// Função para parsing de valores monetários
function parseMonetaryValue(str: any): number {
  if (!str) return 0;
  
  let cleanValue = str.toString().trim();
  let isNegative = false;
  
  // Handle negative values in parentheses
  if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
    isNegative = true;
    cleanValue = cleanValue.slice(1, -1);
  }
  
  // Remove currency symbols and spaces
  cleanValue = cleanValue.replace(/[R$\s()]/g, '');
  
  // Handle explicit negative sign
  if (cleanValue.startsWith('-')) {
    isNegative = true;
    cleanValue = cleanValue.substring(1);
  }
  
  // Enhanced Brazilian number format handling
  if (cleanValue.includes(',') && cleanValue.includes('.')) {
    const lastCommaIndex = cleanValue.lastIndexOf(',');
    const lastDotIndex = cleanValue.lastIndexOf('.');
    
    if (lastCommaIndex > lastDotIndex) {
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else {
      cleanValue = cleanValue.replace(/,/g, '');
    }
  } else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
    cleanValue = cleanValue.replace(',', '.');
  }
  
  const result = parseFloat(cleanValue) || 0;
  return isNegative ? -result : result;
}

// Função para detectar encoding
function detectEncoding(buffer: Buffer): string {
  const content = buffer.toString('utf-8');
  const hasValidUTF8 = !content.includes('\uFFFD') && content.length > 0;
  
  if (hasValidUTF8) return 'utf-8';
  
  // Test other encodings
  const encodings = ['latin1', 'ascii', 'utf16le'];
  for (const encoding of encodings) {
    try {
      const decoded = buffer.toString(encoding as BufferEncoding);
      if (decoded && decoded.length > 0 && !decoded.includes('\uFFFD')) {
        return encoding;
      }
    } catch {
      continue;
    }
  }
  
  return 'utf-8'; // fallback
}

// Função para extrair valores usando 3 estratégias
function extractValueWithStrategies(rows: any[][], i: number, isAPagar: boolean): number | null {
  const row = rows[i];
  let foundValue: number | null = null;
  
  console.log(`Extracting ${isAPagar ? 'A PAGAR' : 'A RECEBER'} value from row ${i}`);
  
  // Strategy 1: Look for monetary values in the same row
  for (let k = 0; k < row.length; k++) {
    const cellValue = row[k]?.toString().trim() || '';
    if (isMonetaryValue(cellValue)) {
      const value = parseMonetaryValue(cellValue);
      if (value > 0) {
        console.log(`Strategy 1 - Found value in row ${i} col ${k}: ${value}`);
        foundValue = value;
        break;
      }
    }
  }
  
  // Strategy 2: Look in next few rows if not found in same row
  if (!foundValue) {
    for (let rowOffset = 1; rowOffset <= 5; rowOffset++) {
      if (i + rowOffset >= rows.length) break;
      
      const checkRow = rows[i + rowOffset];
      if (!checkRow || !Array.isArray(checkRow)) continue;
      
      for (let k = 0; k < checkRow.length; k++) {
        const cellValue = checkRow[k]?.toString().trim() || '';
        if (isMonetaryValue(cellValue)) {
          const value = parseMonetaryValue(cellValue);
          if (value > 0) {
            console.log(`Strategy 2 - Found value at row ${i + rowOffset} col ${k}: ${value}`);
            foundValue = value;
            break;
          }
        }
      }
      if (foundValue) break;
    }
  }
  
  // Strategy 3: Look for specific CSV patterns (col2=TOTAL, col3=value)
  if (!foundValue && row.length >= 4) {
    const col2Text = row[2]?.toString().toUpperCase().trim() || '';
    const col3Value = row[3]?.toString().trim() || '';
    
    if (col2Text.includes('TOTAL') && isMonetaryValue(col3Value)) {
      const value = parseMonetaryValue(col3Value);
      if (value > 0) {
        console.log(`Strategy 3 - Found value using CSV pattern: ${value}`);
        foundValue = value;
      }
    }
  }
  
  return foundValue;
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    console.log('=== DEBUG UPLOAD CSV SUMMARY ===');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Garantir que a pasta temp existe
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Configurar formidable para upload de múltiplos arquivos
    const form = formidable({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFiles: 10,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      // Remover filter para aceitar todos os arquivos por enquanto
    });

    const [fields, files] = await form.parse(req);
    
    // Suportar tanto 'csvFiles' quanto 'files' (compatibilidade com frontend)
    const uploadedFiles = files.csvFiles || files.files;
    const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles].filter(Boolean);
    
    console.log('All files received:', allFiles.length);
    console.log('File details:', allFiles.map(f => ({ name: f?.originalFilename, size: f?.size, type: f?.mimetype })));
    
    // Filtrar apenas arquivos CSV
    const csvFiles = allFiles.filter(file => 
      file && file.originalFilename && 
      (file.originalFilename.endsWith('.csv') || file.mimetype === 'text/csv')
    );
    
    console.log('CSV Files found:', csvFiles.length);
    
    if (csvFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo CSV foi enviado'
      });
    }

    // INICIALIZAÇÃO DE VARIÁVEIS GLOBAIS
    const branches: any[] = [];
    let grandTotalAPagar = 0;
    let grandTotalAReceber = 0;
    const documentDates = new Map<string, number>();
    
    // LOOP DE PROCESSAMENTO POR ARQUIVO/FILIAL
    for (const file of csvFiles) {
      if (!file || !file.filepath) continue;
      
      // Cada arquivo representa uma filial individual
      let branchName = file.originalFilename?.replace(/\.(csv|CSV)$/, '').trim() || 'FILIAL_DESCONHECIDA';
      let totalAPagar = 0;
      let totalAReceber = 0;
      
      console.log(`\n=== PROCESSING BRANCH: ${branchName} ===`);
      
      const buffer = fs.readFileSync(file.filepath);
      const encoding = detectEncoding(buffer);
      const csvContent = buffer.toString(encoding as BufferEncoding);
      
      // Parse do CSV individual
      const parseResult = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });
      
      const rows = parseResult.data as any[];
      console.log(`Parsed ${rows.length} rows for branch ${branchName}`);
      
      // EXTRAÇÃO DO NOME DA FILIAL DA PRIMEIRA LINHA
      if (rows.length > 0 && rows[0] && Array.isArray(rows[0]) && rows[0][0]) {
        const firstLineContent = rows[0][0].toString().trim();
        if (firstLineContent && firstLineContent !== '') {
          branchName = firstLineContent;
          console.log(`Using first line as branch name: ${branchName}`);
        }
      }
      
      // PROCESSAMENTO DAS LINHAS PARA ENCONTRAR TOTAIS
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        
        const rowText = row.join(' ').toUpperCase().replace(/\s+/g, ' ');
        
        // DETECÇÃO DE TOTAL A PAGAR
        const isAPagarTotalRow = 
          rowText.includes('TOTAL CONTAS A PAGAR') || 
          rowText.includes('TOTALCONTASAPAGAR') ||
          rowText.includes('TOTAL A PAGAR') ||
          rowText.includes('TOTALPAGAR') ||
          (rowText.includes('TOTAL') && rowText.includes('PAGAR') && !rowText.includes('RECEBER')) ||
          rowText.match(/TOTAL.*A.*PAGAR/) ||
          rowText.match(/TOTAL.*PAGAR/);
          
        // DETECÇÃO DE TOTAL A RECEBER
        const isAReceberTotalRow = 
          rowText.includes('TOTAL CONTAS A RECEBER') ||
          rowText.includes('TOTALCONTASARECEBER') ||
          rowText.includes('TOTAL A RECEBER') ||
          rowText.includes('TOTALRECEBER') ||
          (rowText.includes('TOTAL') && rowText.includes('RECEBER') && !rowText.includes('PAGAR')) ||
          rowText.match(/TOTAL.*A.*RECEBER/) ||
          rowText.match(/TOTAL.*RECEBER/);
        
        if (isAPagarTotalRow) {
          console.log(`Found A PAGAR total row at ${i}: ${rowText}`);
          const foundValue = extractValueWithStrategies(rows, i, true);
          if (foundValue && foundValue > totalAPagar) {
            totalAPagar = foundValue;
            console.log(`Set totalAPagar for ${branchName} to: ${totalAPagar}`);
          }
        }
        
        if (isAReceberTotalRow) {
          console.log(`Found A RECEBER total row at ${i}: ${rowText}`);
          const foundValue = extractValueWithStrategies(rows, i, false);
          if (foundValue && foundValue > totalAReceber) {
            totalAReceber = foundValue;
            console.log(`Set totalAReceber for ${branchName} to: ${totalAReceber}`);
          }
        }
        
        // PROCESSAMENTO DE DATAS DE DOCUMENTOS
        const firstCell = row[0]?.toString().trim() || '';
        const dateMatch = firstCell.match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
        if (dateMatch && row.length >= 4) {
          const transactionDate = dateMatch[1];
          const valueText = row[3]?.toString().trim() || '';
          
          if (valueText.match(/^[R$\s\-]*[\d.,]+$/)) {
            const value = parseMonetaryValue(valueText);
            if (!isNaN(value) && value > 0) {
              if (!documentDates.has(transactionDate)) {
                documentDates.set(transactionDate, 0);
              }
              documentDates.set(transactionDate, documentDates.get(transactionDate)! + value);
            }
          }
        }
      }
      
      // ARMAZENAMENTO DOS RESULTADOS POR FILIAL
      branches.push({
        name: branchName,
        totalAPagar,
        totalAReceber,
        total: totalAPagar + totalAReceber
      });
      
      // AGREGAÇÃO AOS TOTAIS GERAIS
      grandTotalAPagar += totalAPagar;
      grandTotalAReceber += totalAReceber;
      
      console.log(`Branch ${branchName} totals - A Pagar: ${totalAPagar}, A Receber: ${totalAReceber}`);
    }
    
    // CONSOLIDAÇÃO FINAL
    // Converter datas consolidadas para array
    const dateSpecificTotalsArray = Array.from(documentDates.entries())
      .map(([dateStr, total]) => {
        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
          const sortDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
          return { day: dateStr, total, sortDate, isValid: !isNaN(sortDate.getTime()) };
        }
        return { day: dateStr, total, sortDate: new Date(), isValid: false };
      })
      .filter(item => item.isValid)
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .map(({ day, total }) => ({ day, total }));
    
    // Estrutura de retorno
    const summaryData: SummaryData = {
      branches, // Array com cada filial separada
      dateSpecificTotals: dateSpecificTotalsArray, // Totais consolidados por data
      grandTotal: dateSpecificTotalsArray.reduce((sum, item) => sum + item.total, 0),
      grandTotalAPagar,
      grandTotalAReceber
    };
    
    console.log('=== FINAL SUMMARY ===');
    console.log('Branches processed:', branches.length);
    console.log('Grand total A Pagar:', grandTotalAPagar);
    console.log('Grand total A Receber:', grandTotalAReceber);
    console.log('Date-specific totals:', dateSpecificTotalsArray.length);

    // Limpar arquivos temporários
    for (const file of csvFiles) {
      if (file && file.filepath && fs.existsSync(file.filepath)) {
        try {
          fs.unlinkSync(file.filepath);
        } catch (error) {
          console.error('Erro ao limpar arquivo temporário:', error);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `${csvFiles.length} arquivo(s) processado(s) com sucesso`,
      data: summaryData
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}