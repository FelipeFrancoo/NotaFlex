import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'
import Papa from 'papaparse'
import path from 'path'
import { storage } from '../../lib/storage'
import { ProcessedData as BaseProcessedData } from '@shared/schema'
import { randomUUID } from 'crypto';

// Extend ProcessedData to include transactions for API processing
interface ProcessedData extends BaseProcessedData {
  transactions: TransactionForExcel[];
}

// Interfaces para tipos de dados processados
interface TransactionData {
  date: Date;
  supplier: string;
  docNumber: string;
  value: number;
  category: string;
  branch: string;
  documentType: 'A_PAGAR' | 'A_RECEBER';
  sourceFile: string; // Nome original do arquivo para separar categorias no Excel
}

interface TransactionForExcel {
  vencimento: string;
  transacionador: string;
  documento: string;
  valor: string;
  valorNumerico: number;
  documentType?: 'A_PAGAR' | 'A_RECEBER';
  filial?: string;
  sourceFile?: string;
}

interface DocumentoProcessado {
  dataVencimento: Date;
  transacionador: string;
  numeroDocumento: string;
  valor: number;
  valorOriginal: string;
  categoria: 'A_PAGAR' | 'A_RECEBER';
  filial: string;
}

// Função para parsing de datas CSV (EXATA)
function parseCSVDate(dateStr: string): Date {
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY (formato brasileiro)
    /(\d{4})-(\d{1,2})-(\d{1,2})/,  // YYYY-MM-DD (formato ISO)
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // DD/MM/YYYY - formato brasileiro
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else {
        // YYYY-MM-DD - formato ISO
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
  }
  
  return new Date(dateStr); // Fallback
}

// Função auxiliar para semana (EXATA)
function getWeekBoundaries(date: Date): { weekStart: Date; weekEnd: Date } {
  const dayOfWeek = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
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

// Interface para documento extraído conforme especificação
interface DocumentoExtraido {
  dataVencimento: Date;           // Data parseada da coluna 1
  transacionador: string;         // TRANSACIONADOR da coluna 2 (DADO PRINCIPAL)
  numeroDocumento: string;        // NÚMERO DO DOCUMENTO da coluna 3 (DADO PRINCIPAL)
  valor: number;                  // Valor numérico da coluna 5
  valorOriginal: string;          // Valor original como string
  categoria: 'A_PAGAR' | 'A_RECEBER';
  filial: string;                 // Nome da filial
  weekStart: Date;                // Início da semana
  weekEnd: Date;                  // Fim da semana
  sourceFile: string;             // Nome do arquivo fonte
}

// Função para extrair transacionador e documento seguindo especificação EXATA
function extrairTransacionadorEDocumento(csvContent: string, documentType: 'A_PAGAR' | 'A_RECEBER', nomeFilial: string): DocumentoExtraido[] {
  // Parse CSV sem headers
  const parseResult = Papa.parse(csvContent, {
    header: false,
    skipEmptyLines: true,
  });
  
  const rows = parseResult.data as any[];
  const documentosExtraidos: DocumentoExtraido[] = [];
  
  // Processar cada linha do CSV
  for (const row of rows) {
    // VALIDAÇÃO ESTRUTURAL OBRIGATÓRIA
    if (!Array.isArray(row) || row.length < 5) continue;
    
    const category = row[0]?.toString().trim() || '';
    let dateStr = '';
    let transacionador = '';
    let numeroDocumento = '';
    let valueStr = '';
    
    // LÓGICA DE IDENTIFICAÇÃO POR TIPO DE DOCUMENTO
    if (documentType === 'A_PAGAR') {
      // Match EXATO - não usar includes()
      if (category !== 'Contas a pagar- À vencer') continue;
      
      // MAPEAMENTO FIXO DAS COLUNAS:
      dateStr = row[1]?.toString().trim() || '';           // COLUNA 1: Data Vencimento
      transacionador = row[2]?.toString().trim() || '';    // COLUNA 2: TRANSACIONADOR
      numeroDocumento = row[3]?.toString().trim() || '';   // COLUNA 3: NÚMERO DO DOCUMENTO
      valueStr = row[5]?.toString().trim() || '0';         // COLUNA 5: Valor (SEMPRE coluna 5)
      
    } else if (documentType === 'A_RECEBER') {
      // Match EXATO - não usar includes()
      if (category !== 'Contas a receber - A vencer') continue;
      
      // MAPEAMENTO FIXO DAS COLUNAS:
      dateStr = row[1]?.toString().trim() || '';           // COLUNA 1: Data Vencimento
      transacionador = row[2]?.toString().trim() || '';    // COLUNA 2: TRANSACIONADOR
      numeroDocumento = row[3]?.toString().trim() || '';   // COLUNA 3: NÚMERO DO DOCUMENTO
      valueStr = row[5]?.toString().trim() || '0';         // COLUNA 5: Valor (SEMPRE coluna 5)
    }
    
    // VALIDAÇÕES OBRIGATÓRIAS DOS DADOS EXTRAÍDOS
    if (!dateStr || !transacionador || !valueStr) continue;
    
    // PARSING DA DATA DE VENCIMENTO
    const date = parseCSVDate(dateStr);
    if (!date || isNaN(date.getTime())) continue;
    
    // PARSING DO VALOR MONETÁRIO (formato brasileiro)
    let cleanValue = valueStr.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const isNegative = cleanValue.startsWith('-');
    if (isNegative) {
      cleanValue = cleanValue.substring(1);
    }
    const value = parseFloat(cleanValue);
    if (isNaN(value) || value <= 0) continue;
    
    // APLICAÇÃO DE FALLBACKS PARA CAMPOS OBRIGATÓRIOS
    const transacionadorFinal = transacionador || 'FORNECEDOR NÃO IDENTIFICADO';
    const numeroDocumentoFinal = numeroDocumento || ''; // Removido fallback 'PENDENTE'
    
    // ESTRUTURA FINAL DOS DADOS EXTRAÍDOS
    const { weekStart, weekEnd } = getWeekBoundaries(date);
    documentosExtraidos.push({
      dataVencimento: date,
      transacionador: transacionadorFinal,      // DADO PRINCIPAL EXTRAÍDO
      numeroDocumento: numeroDocumentoFinal,    // DADO PRINCIPAL EXTRAÍDO
      valor: value,
      valorOriginal: valueStr,
      categoria: documentType,
      filial: nomeFilial,
      // Dados de compatibilidade
      weekStart: weekStart,
      weekEnd: weekEnd,
      sourceFile: `${nomeFilial}.csv`
    });
  }
  
  return documentosExtraidos;
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
    // Opcional: limpar dados anteriores se solicitado
    if (req.query.clearData === 'true') {
      storage.delete('summaryData');
      storage.delete('processedData');
    }
    console.log('=== DEBUG UPLOAD CSV ===');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
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
    
    console.log('=== PARSED DATA ===');
    console.log('Fields:', JSON.stringify(fields, null, 2));
    console.log('Files keys:', Object.keys(files));
    console.log('Files structure:', JSON.stringify(files, null, 2));
    
    // Obter tipos de documento selecionados
    let selectedTypes: ('A_PAGAR' | 'A_RECEBER')[] = ['A_PAGAR', 'A_RECEBER']; // Default
    
    if (fields.documentTypes && fields.documentTypes.length > 0) {
      const documentTypesString = fields.documentTypes[0] as string;
      console.log('documentTypesString recebido:', documentTypesString);
      
      try {
        // Tentar fazer parse se for JSON
        const parsed = JSON.parse(documentTypesString);
        console.log('JSON parsed:', parsed);
        
        if (Array.isArray(parsed)) {
          selectedTypes = parsed;
        } else if (typeof parsed === 'object') {
          // Se for um objeto com indices, extrair os valores e flatten
          const allTypes: string[] = [];
          Object.values(parsed).forEach(typeArray => {
            if (Array.isArray(typeArray)) {
              allTypes.push(...typeArray);
            }
          });
          // Remover duplicatas
          const uniqueTypes = Array.from(new Set(allTypes));
          selectedTypes = uniqueTypes as ('A_PAGAR' | 'A_RECEBER')[];
        }
      } catch (e) {
        console.log('Erro no parse JSON:', e);
        // Se não for JSON, usar como array direto
        selectedTypes = Array.isArray(fields.documentTypes) 
          ? fields.documentTypes as ('A_PAGAR' | 'A_RECEBER')[]
          : [documentTypesString as 'A_PAGAR' | 'A_RECEBER'];
      }
    }
    
    console.log('Selected types processados:', selectedTypes);
    
    // NORMALIZAÇÃO ROBUSTA DE ARQUIVOS (multi-field, multi-file)
    const allFiles = Object.values(files).flat().filter(Boolean) as formidable.File[];
    
    console.log('=== FILE PROCESSING ===');
    console.log('allFiles (normalizado):', allFiles.map(f => ({ originalFilename: f.originalFilename, path: f.filepath })));
    console.log('allFiles length:', allFiles.length);
    
    // Filtrar apenas arquivos CSV - sendo mais permissivo para debug
    const csvFiles = allFiles.filter(file => {
      console.log('Checking file:', file ? {
        originalFilename: file.originalFilename,
        mimetype: file.mimetype,
        size: file.size,
        filepath: file.filepath
      } : 'null file');
      
      if (!file || !file.originalFilename) return false;
      // Aceitar .csv ou .txt (alguns sistemas exportam assim), case insensitive
      return /\.(csv|txt)$/i.test(file.originalFilename);
    });
    
    console.log('=== FILTERING RESULTS ===');
    console.log('CSV Files found:', csvFiles.length);
    console.log('Selected types:', selectedTypes);
    console.log('CSV Files details:', csvFiles.map(f => f ? {
      name: f.originalFilename,
      type: f.mimetype,
      size: f.size
    } : null));
    
    if (csvFiles.length === 0) {
      console.log('=== ERROR: NO FILES ===');
      console.log('No CSV files found after filtering');
      return res.status(400).json({
        success: false,
        message: `Nenhum arquivo foi encontrado. Arquivos recebidos: ${allFiles.length}. Verifique se o arquivo é um CSV válido.`
      });
    }

    const allTransactions: TransactionData[] = [];
    const allFilesData: any[] = [];
    const allFilesResults: any[] = [];
    // Processar cada arquivo CSV
    for (const file of csvFiles) {
      console.log(`=== PROCESSING FILE: ${file?.originalFilename} ===`);
      
      if (!file || !file.filepath) {
        console.log('Skipping invalid file:', file);
        continue;
      }
      try {
      
      console.log('File path:', file.filepath);
      console.log('File exists:', fs.existsSync(file.filepath));
      
      const buffer = fs.readFileSync(file.filepath);
      const encoding = detectEncoding(buffer);
      const csvContent = buffer.toString(encoding as BufferEncoding);
      
      // Extrair nome da filial
      const branchName = (file.originalFilename || 'FILIAL_DESCONHECIDA')
        .replace(/\.(csv|txt)$/i, '')
        .toUpperCase();
      
      const fileTransactions: TransactionData[] = [];
      
      // Processar cada tipo de documento selecionado usando a nova lógica
      for (const documentType of selectedTypes as ('A_PAGAR' | 'A_RECEBER')[]) {
        console.log(`Processando tipo de documento: ${documentType} para arquivo: ${file.originalFilename}`);
        
        // Usar a função de extração específica com a lógica correta
        const documentosExtraidos = extrairTransacionadorEDocumento(csvContent, documentType, branchName);
        
        console.log(`Documentos extraídos para ${documentType}:`, documentosExtraidos.length);
        
        // Log dos primeiros documentos para debug
        if (documentosExtraidos.length > 0) {
          console.log('Primeiros documentos extraídos:', documentosExtraidos.slice(0, 3).map(doc => ({
            transacionador: doc.transacionador,
            numeroDocumento: doc.numeroDocumento,
            valor: doc.valor,
            dataVencimento: doc.dataVencimento.toLocaleDateString('pt-BR')
          })));
        }
        
        // Converter para o formato TransactionData (manter compatibilidade)
        for (const doc of documentosExtraidos) {
          const transaction: TransactionData = {
            date: doc.dataVencimento,
            supplier: doc.transacionador,        // TRANSACIONADOR CORRETO da coluna 2
            docNumber: doc.numeroDocumento,      // NÚMERO DO DOCUMENTO CORRETO da coluna 3
            value: doc.valor,
            category: documentType === 'A_PAGAR' ? 'Contas a pagar- À vencer' : 'Contas a receber - A vencer',
            branch: doc.filial,
            documentType: doc.categoria,
            sourceFile: file.originalFilename || `${branchName}.csv`
          };
          
          fileTransactions.push(transaction);
          allTransactions.push(transaction);
        }
      }
      
      allFilesData.push({
        filename: file.originalFilename,
        branch: branchName,
        transactions: fileTransactions,
        totalTransactions: fileTransactions.length
      });
      
      // Agregação individual por arquivo
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
      fileTransactions.forEach(transaction => {
        const { branch, date, value, documentType } = transaction;
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
        if (documentType === 'A_PAGAR') {
          totalPayable += value;
        } else if (documentType === 'A_RECEBER') {
          totalReceivable += value;
        }
        grandTotalValue += value;
      });
      const branchTotals = Array.from(branchTotalsMap.entries()).map(([branch, data]) => ({
        id: randomUUID(),
        branch,
        invoiceCount: data.invoiceCount,
        totalValue: `R$ ${data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd
      }));
      const dailyTotals = Array.from(dailyTotalsMap.values()).map(data => ({
        id: randomUUID(),
        ...data,
        totalValue: `R$ ${data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      }));
      const workingDaysTotal = dailyTotals
        .filter(d => ![0, 6].includes(d.date.getDay()))
        .reduce((sum, d) => sum + parseMonetaryValue(d.totalValue), 0);
      const weekendTotal = dailyTotals
        .filter(d => [0, 6].includes(d.date.getDay()))
        .reduce((sum, d) => sum + parseMonetaryValue(d.totalValue), 0);
      const workingDays = dailyTotals.filter(d => ![0, 6].includes(d.date.getDay())).length;
      const weekendDays = dailyTotals.filter(d => [0, 6].includes(d.date.getDay())).length;
      const minDate = fileTransactions.length > 0 
        ? new Date(Math.min(...fileTransactions.map(t => t.date.getTime())))
        : new Date();
      const maxDate = fileTransactions.length > 0 
        ? new Date(Math.max(...fileTransactions.map(t => t.date.getTime())))
        : new Date();
      allFilesResults.push({
        filename: file.originalFilename,
        branch: branchName,
        processedData: {
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
          totalInvoices: fileTransactions.length
        }
      });
      // Limpar arquivo temporário
      if (file.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      } catch(processFileErr) {
        console.error('Erro ao processar arquivo individual, continuando com os demais:', file?.originalFilename, processFileErr);
        continue;
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
      id: randomUUID(),
      branch,
      invoiceCount: data.invoiceCount,
      totalValue: `R$ ${data.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd
    }));
    
    const dailyTotals = Array.from(dailyTotalsMap.values()).map(data => ({
      id: randomUUID(),
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
      totalInvoices: allTransactions.length,
      transactions: allTransactions.map(transaction => ({
        vencimento: transaction.date.toLocaleDateString('pt-BR'),
        transacionador: transaction.supplier,  // USANDO supplier CORRETO
        documento: transaction.docNumber,      // USANDO docNumber CORRETO  
        valor: `R$ ${transaction.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        valorNumerico: transaction.value,
        documentType: transaction.documentType, // preserva tipo real (A_PAGAR / A_RECEBER)
        filial: transaction.branch,             // preserva filial
        sourceFile: transaction.sourceFile      // nome original do arquivo
      }))
    };

    // Cache dos dados processados para exportação posterior sem precisar reenviar pelo frontend
    try {
      const cachePath = path.join(tempDir, 'last_processed.json');
      fs.writeFileSync(cachePath, JSON.stringify(processedData, null, 2), 'utf8');
    } catch (cacheErr) {
      console.warn('Não foi possível salvar cache de processedData:', cacheErr);
    }

    // ===== INÍCIO: GERAÇÃO DE summaryData PARA /api/export-summary-excel =====
    try {
      // Guardar processedData em memória também
      storage.set('processedData', processedData);

      // Mapear transações em estrutura compatível
      interface SummaryBranch {
        name: string; totalAPagar: number; totalAReceber: number; total: number;
      }
      const branchMap: Record<string, { pagar: number; receber: number }> = {};
      const dateTotalsMap: Record<string, number> = {};

      processedData.transactions.forEach(tr => {
        const branch = tr.filial || tr.sourceFile?.replace(/\.csv$/i, '') || 'DESCONHECIDA';
        if (!branchMap[branch]) branchMap[branch] = { pagar: 0, receber: 0 };
        if (tr.documentType === 'A_PAGAR') branchMap[branch].pagar += tr.valorNumerico;
        else if (tr.documentType === 'A_RECEBER') branchMap[branch].receber += tr.valorNumerico;

        // Totais por data (usando apenas A_PAGAR para manter consistência com resumo anterior)
        if (tr.documentType === 'A_PAGAR') {
          const dateStr = tr.vencimento; // já em DD/MM/YYYY
            if (!dateTotalsMap[dateStr]) dateTotalsMap[dateStr] = 0;
            dateTotalsMap[dateStr] += tr.valorNumerico;
        }
      });

      const branchesSummary: SummaryBranch[] = Object.entries(branchMap).map(([name, v]) => ({
        name,
        totalAPagar: v.pagar,
        totalAReceber: v.receber,
        total: v.pagar + v.receber
      }));

      // Construir dateSpecificTotals ordenado
      const dateSpecificTotals = Object.entries(dateTotalsMap).map(([day, total]) => ({ day, total }))
        .filter(d => /\d{1,2}\/\d{1,2}\/\d{4}/.test(d.day))
        .sort((a, b) => {
          const [da, ma, ya] = a.day.split('/').map(Number);
          const [db, mb, yb] = b.day.split('/').map(Number);
          return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
        });

      // DocumentDates com dia da semana (apenas dias úteis)
      const documentDates = dateSpecificTotals.map(d => {
        const [day, month, year] = d.day.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return { day: d.day, dayOfWeek: dayNames[date.getDay()], total: d.total, date };
      }).filter(item => {
        const dow = item.date.getDay();
        return dow >= 1 && dow <= 5; // dias úteis
      }).sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(({ day, dayOfWeek, total }) => ({ day, dayOfWeek, total }));

      const grandTotalAPagar = branchesSummary.reduce((s, b) => s + b.totalAPagar, 0);
      const grandTotalAReceber = branchesSummary.reduce((s, b) => s + b.totalAReceber, 0);
      const grandTotal = dateSpecificTotals.reduce((s, d) => s + d.total, 0);

      const summaryData = {
        branches: branchesSummary,
        dailyTotals: [], // não utilizado no export atual
        documentDates,
        dateSpecificTotals,
        grandTotal,
        grandTotalAPagar,
        grandTotalAReceber,
        totalAPagar: grandTotalAPagar
      };

      storage.set('summaryData', summaryData);
    } catch(summaryErr) {
      console.warn('Falha ao gerar summaryData a partir de processedData:', summaryErr);
    }
    // ===== FIM: GERAÇÃO DE summaryData =====

    // Create response data without transactions to match client schema
    const { transactions, ...clientProcessedData } = processedData;

    return res.status(200).json({
      success: true,
      message: `${csvFiles.length} arquivo(s) processado(s) com sucesso`,
      data: allFilesResults,
      summaryData: storage.get('summaryData') || null,
      allFilesData
    });
  } catch (error) {
    console.error('=== ERROR IN UPLOAD-CSV ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor: ' + (error instanceof Error ? error.message : String(error))
    })
  }
}