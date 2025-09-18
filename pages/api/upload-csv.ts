import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import Papa from 'papaparse'

// Interfaces para tipos de dados processados
interface ProcessedData {
  branchTotals: Array<{
    branch: string;
    invoiceCount: number;
    totalValue: string;
    weekStart: Date;
    weekEnd: Date;
  }>;
  dailyTotals: Array<{
    date: Date;
    dayOfWeek: string;
    totalValue: string;
    invoiceCount: number;
    branch: string;
  }>;
  weeklyTotals: {
    workingDaysTotal: string;
    weekendTotal: string;
    weekTotal: string;
    workingDays: number;
    weekendDays: number;
    weekPeriod: string;
    totalPayable: number;
    totalReceivable: number;
  };
  grandTotal: string;
  totalInvoices: number;
}

interface TransactionData {
  date: Date;
  supplier: string;
  docNumber: string;
  value: number;
  category: string;
  branch: string;
  documentType: 'A_PAGAR' | 'A_RECEBER';
}

// Função para parsing de datas CSV
function parseCSVDate(dateStr: string): Date {
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
  }
  return new Date(dateStr);
}

// Função para parsing de valores monetários
function parseMonetaryValue(str: string): number {
  let cleanValue = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  
  const isNegative = cleanValue.startsWith('-');
  if (isNegative) {
    cleanValue = cleanValue.substring(1);
  }
  
  const value = parseFloat(cleanValue);
  return isNegative ? -value : value;
}

// Função para validar valores monetários
function isMonetaryValue(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  
  const patterns = [
    /^R\$\s*[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/, // R$ 1.234.567,89
    /^[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/, // 1.234.567,89
    /^[\d]+,[\d]{2}$/, // 12345,89
    /^R\$\s*[\d.,]+$/, // R$ com vários formatos
  ];
  
  return patterns.some(pattern => pattern.test(str.trim()));
}

// Função para calcular limites de semana
function getWeekBoundaries(date: Date): { weekStart: Date; weekEnd: Date } {
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Segunda
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Domingo
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

// Função para detectar encoding
function detectEncoding(buffer: Buffer): string {
  const encodings = ['utf-8', 'latin1', 'ascii', 'utf16le'];
  
  for (const encoding of encodings) {
    try {
      const decoded = buffer.toString(encoding as BufferEncoding);
      // Verificar se contém caracteres especiais brasileiros
      if (decoded.includes('ç') || decoded.includes('ã') || decoded.includes('é')) {
        return encoding;
      }
    } catch (error) {
      continue;
    }
  }
  return 'utf-8'; // fallback
}

// Configuração para desabilitar o parser padrão do Next.js
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
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('=== DEBUG UPLOAD CSV ===');
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
    
    console.log('Parsed fields:', fields);
    console.log('Parsed files keys:', Object.keys(files));
    console.log('Files structure:', files);
    
    // Obter tipos de documento selecionados
    const selectedTypes = (fields.documentTypes as string[]) || ['A_PAGAR', 'A_RECEBER'];
    
    // Suportar tanto 'csvFiles' quanto 'files' (compatibilidade com frontend)
    const uploadedFiles = files.csvFiles || files.files;
    const allFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles].filter(Boolean);
    
    // Filtrar apenas arquivos CSV
    const csvFiles = allFiles.filter(file => 
      file && file.originalFilename && 
      (file.originalFilename.endsWith('.csv') || file.mimetype === 'text/csv')
    );
    
    console.log('CSV Files found:', csvFiles.length);
    console.log('Selected types:', selectedTypes);
    
    if (csvFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo CSV foi enviado'
      });
    }

    const allTransactions: TransactionData[] = [];
    const allFilesData: any[] = [];
    
    // Processar cada arquivo CSV
    for (const file of csvFiles) {
      if (!file || !file.filepath) continue;
      
      const buffer = fs.readFileSync(file.filepath);
      const encoding = detectEncoding(buffer);
      const csvContent = buffer.toString(encoding as BufferEncoding);
      
      // Extrair nome da filial
      const branchName = file.originalFilename?.replace('.csv', '').toUpperCase() || 'FILIAL_DESCONHECIDA';
      
      // Parse CSV sem headers
      const parseResult = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });
      
      const rows = parseResult.data as string[][];
      
      // Extrair nome da filial da primeira linha (fallback)
      let extractedBranchName = branchName;
      if (rows.length > 0 && rows[0][0]) {
        const firstRowText = rows[0][0].toString().trim();
        if (firstRowText && !firstRowText.includes('Período') && !firstRowText.includes('Vencimento')) {
          extractedBranchName = firstRowText.toUpperCase();
        }
      }
      
      const fileTransactions: TransactionData[] = [];
      
      // Processar cada tipo de documento selecionado
      for (const documentType of selectedTypes as ('A_PAGAR' | 'A_RECEBER')[]) {
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4) continue;
          
          // Pular linhas de cabeçalho e informações
          const firstCol = row[0]?.toString().trim();
          if (!firstCol || 
              firstCol.includes('CONTAS A') || 
              firstCol.includes('PERÍODO') || 
              firstCol.includes('Vencimento') ||
              firstCol === '' ||
              firstCol === ';;;') {
            continue;
          }
          
          // Para este formato: [data, fornecedor, documento, valor]
          const dateStr = row[0]?.toString().trim();
          const supplier = row[1]?.toString().trim();
          const docNumber = row[2]?.toString().trim();
          const valueStr = row[3]?.toString().trim();
          
          // Validar se é uma linha de dados válida
          if (!dateStr || !supplier || !valueStr) continue;
          
          // Verificar se é uma data válida (formato DD/MM/YYYY)
          if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) continue;
          
          // Verificar se o valor é monetário
          if (!isMonetaryValue(valueStr)) continue;
          
          try {
            const date = parseCSVDate(dateStr);
            const value = parseMonetaryValue(valueStr);
            
            if (value > 0) {
              const transaction: TransactionData = {
                date,
                supplier,
                docNumber: docNumber || '',
                value,
                category: 'Contas a pagar- À vencer', // Inferir categoria baseado no arquivo
                branch: extractedBranchName,
                documentType: 'A_PAGAR' // Assumir A_PAGAR para este formato
              };
              
              fileTransactions.push(transaction);
              allTransactions.push(transaction);
            }
          } catch (error) {
            console.warn(`Erro ao processar linha ${i}:`, error);
          }
        }
      }
      
      allFilesData.push({
        filename: file.originalFilename,
        branch: extractedBranchName,
        transactions: fileTransactions,
        totalTransactions: fileTransactions.length
      });
      
      // Limpar arquivo temporário
      if (file.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
    }
    
    // Agregação de dados
    const branchTotalsMap = new Map<string, {
      invoiceCount: number;
      totalValue: number;
      weekStart: Date;
      weekEnd: Date;
    }>();
    
    const dailyTotalsMap = new Map<string, {
      date: Date;
      dayOfWeek: string;
      totalValue: number;
      invoiceCount: number;
      branch: string;
    }>();
    
    let totalPayable = 0;
    let totalReceivable = 0;
    let grandTotalValue = 0;
    
    // Processar transações para agregação
    allTransactions.forEach(transaction => {
      const { branch, date, value, documentType } = transaction;
      
      // Atualizar totais por filial
      const { weekStart, weekEnd } = getWeekBoundaries(date);
      const branchKey = branch;
      
      if (!branchTotalsMap.has(branchKey)) {
        branchTotalsMap.set(branchKey, {
          invoiceCount: 0,
          totalValue: 0,
          weekStart,
          weekEnd
        });
      }
      
      const branchTotal = branchTotalsMap.get(branchKey)!;
      branchTotal.invoiceCount++;
      branchTotal.totalValue += value;
      
      // Atualizar totais diários
      const dateKey = `${branch}-${date.toISOString().split('T')[0]}`;
      const dayOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
      
      if (!dailyTotalsMap.has(dateKey)) {
        dailyTotalsMap.set(dateKey, {
          date,
          dayOfWeek,
          totalValue: 0,
          invoiceCount: 0,
          branch
        });
      }
      
      const dailyTotal = dailyTotalsMap.get(dateKey)!;
      dailyTotal.totalValue += value;
      dailyTotal.invoiceCount++;
      
      // Atualizar totais por tipo
      if (documentType === 'A_PAGAR') {
        totalPayable += value;
      } else if (documentType === 'A_RECEBER') {
        totalReceivable += value;
      }
      
      grandTotalValue += value;
    });
    
    // Converter Maps para arrays
    const branchTotals = Array.from(branchTotalsMap.entries()).map(([branch, data]) => ({
      branch,
      invoiceCount: data.invoiceCount,
      totalValue: `R$ ${data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd
    }));
    
    const dailyTotals = Array.from(dailyTotalsMap.values()).map(data => ({
      ...data,
      totalValue: `R$ ${data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    }));
    
    // Calcular totais semanais
    const workingDaysTotal = dailyTotals
      .filter(d => ![0, 6].includes(d.date.getDay())) // Não domingo/sábado
      .reduce((sum, d) => sum + parseMonetaryValue(d.totalValue), 0);
      
    const weekendTotal = dailyTotals
      .filter(d => [0, 6].includes(d.date.getDay())) // Domingo/sábado
      .reduce((sum, d) => sum + parseMonetaryValue(d.totalValue), 0);
    
    const workingDays = dailyTotals.filter(d => ![0, 6].includes(d.date.getDay())).length;
    const weekendDays = dailyTotals.filter(d => [0, 6].includes(d.date.getDay())).length;
    
    const minDate = allTransactions.length > 0 
      ? new Date(Math.min(...allTransactions.map(t => t.date.getTime())))
      : new Date();
    const maxDate = allTransactions.length > 0 
      ? new Date(Math.max(...allTransactions.map(t => t.date.getTime())))
      : new Date();
    
    const processedData: ProcessedData = {
      branchTotals,
      dailyTotals,
      weeklyTotals: {
        workingDaysTotal: `R$ ${workingDaysTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        weekendTotal: `R$ ${weekendTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        weekTotal: `R$ ${grandTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        workingDays,
        weekendDays,
        weekPeriod: `${minDate.toLocaleDateString('pt-BR')} - ${maxDate.toLocaleDateString('pt-BR')}`,
        totalPayable,
        totalReceivable
      },
      grandTotal: `R$ ${grandTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      totalInvoices: allTransactions.length
    };

    return res.status(200).json({
      success: true,
      message: `${csvFiles.length} arquivo(s) processado(s) com sucesso`,
      data: processedData,
      allFilesData
    });
  } catch (error) {
    console.error('Error in upload-csv:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    })
  }
}