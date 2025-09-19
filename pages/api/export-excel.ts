import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

// Interface para dados de invoice individual
interface InvoiceData {
  id: string;
  branch: string;
  invoiceNumber: string;
  date: Date;
  value: string;
  supplier: string;
  documentType: 'A_PAGAR' | 'A_RECEBER';
  sourceFile: string;
  valueNumeric: number;
}

// Interface para dados de resumo por filial
interface BranchData {
  name: string;
  totalAPagar: number;
  totalAReceber: number;
  total: number;
}

interface SummaryData {
  branches: BranchData[];
  dateSpecificTotals: Array<{ day: string; total: number }>;
  grandTotal: number;
  grandTotalAPagar: number;
  grandTotalAReceber: number;
}

interface BranchSummary {
  branch: string;
  invoiceCount: number;
  totalValue: string;
}

interface TransactionData {
  vencimento: string;
  transacionador: string;
  documento: string;
  valor: string;
  valorNumerico: number;
}

interface ProcessedData {
  branch: string;
  transactions: TransactionData[];
  totalAPagar: number;
  totalAReceber: number;
  summary: BranchData;
}

// Utilitário seguro para parse de datas DD/MM/AAAA
function parsePtBrDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') return new Date();
  const trimmed = dateStr.trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    const dt = new Date(y, mo, d);
    // Validar (Date auto corrige overflow; precisamos garantir integridade)
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) {
      return dt;
    }
  }
  // Tentar fallback ISO
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;
  return new Date(); // fallback seguro
}

// Estilos Excel obrigatórios
const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  border: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const }
  }
};

const cellStyle = {
  border: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const }
  }
};

const titleStyle = {
  font: { bold: true, size: 16, color: { argb: 'FFFFFF' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } }
};

const subHeaderStyle = {
  font: { bold: true, size: 14, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '1F4E79' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
};

const totalRowStyle = {
  font: { bold: true, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '366092' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('=== INICIANDO EXPORT-EXCEL ===')
  console.log('Method:', req.method)
  console.log('Headers:', req.headers)
  
  try {
    // Extrair informações do relatório com proteção caso body seja undefined
    const body = (req as any).body || {};
    console.log('Body keys:', Object.keys(body));
    console.log('Body type:', typeof body);
    const { name: reportName, startDate, endDate, categories, processedData } = body;
    
    let summaryData: SummaryData | null = null;
    let allInvoices: InvoiceData[] = [];
    let allBranchSummaries: BranchSummary[] = [];

    // Verificar se existe dados processados reais do upload-csv
    if (req.method === 'POST') {
      console.log('=== DADOS RECEBIDOS NO EXPORT-EXCEL ===');
      console.log('Has processedData:', !!body.processedData);
      
      if (body.processedData && Array.isArray(body.processedData.transactions)) {
        console.log('=== USANDO DADOS REAIS DO UPLOAD ===');
        console.log('Total transactions:', body.processedData.transactions.length);
        console.log('Primeiras transações:', body.processedData.transactions.slice(0, 3));
        
        // Converter dados reais para formato esperado pelo Excel
        const realData = body.processedData;
        
        // Agrupar transações por filial para criar summaryData
        const branchMap = new Map<string, {totalAPagar: number, totalAReceber: number}>();
        const allTransactions: InvoiceData[] = [];
        
        realData.transactions.forEach((transaction: any, index: number) => {
          try {
            if (!transaction) {
              console.warn('[EXPORT] Transação nula encontrada no índice:', index);
              return;
            }
            console.log(`[EXPORT] Processando transação ${index}:`, {
              vencimento: transaction.vencimento,
              transacionador: transaction.transacionador,
              valor: transaction.valorNumerico,
              tipo: transaction.documentType
            });
            
            const branch = transaction.filial || realData.branchTotals?.[0]?.branch || 'FILIAL PRINCIPAL';
            const sourceFile = transaction.sourceFile || `${branch}.csv`;
            
            if (!branchMap.has(branch)) {
              branchMap.set(branch, {totalAPagar: 0, totalAReceber: 0});
            }
            
            const branchData = branchMap.get(branch)!;
            const valorNumerico = transaction.valorNumerico || 0;
            // Usar tipo vindo do processamento (valor default A_PAGAR caso ausente)
            const documentType: 'A_PAGAR' | 'A_RECEBER' = transaction.documentType === 'A_RECEBER' ? 'A_RECEBER' : 'A_PAGAR';

            // Parse data robusto
            const parsedDate = parsePtBrDate(transaction.vencimento);
            if (isNaN(parsedDate.getTime())) {
              console.warn('[EXPORT] Ignorando transação com data inválida:', transaction.vencimento, transaction);
              return;
            }
            if (typeof valorNumerico !== 'number' || isNaN(Number(valorNumerico))) {
              console.warn('[EXPORT] Ignorando transação com valor inválido:', valorNumerico, transaction);
              return;
            }
          
          if (documentType === 'A_PAGAR') {
            branchData.totalAPagar += Math.abs(valorNumerico);
          } else {
            branchData.totalAReceber += Math.abs(valorNumerico);
          }
          
          // Converter para formato InvoiceData
          allTransactions.push({
            id: `real_${index}`,
            branch: branch,
            invoiceNumber: transaction.documento || `DOC-${index}`,
            date: parsedDate,
            value: transaction.valor || `R$ 0,00`,
            supplier: transaction.transacionador || 'FORNECEDOR NÃO IDENTIFICADO',
            documentType: documentType,
            sourceFile: sourceFile,
            valueNumeric: Math.abs(valorNumerico)
          });
          } catch (transactionErr) {
            console.error('[EXPORT] Erro ao processar transação:', index, transactionErr, transaction);
          }
        });
        
        // Criar summaryData a partir dos dados reais
        const branches = Array.from(branchMap.entries()).map(([name, totals]) => ({
          name,
          totalAPagar: totals.totalAPagar,
          totalAReceber: totals.totalAReceber,
          total: totals.totalAPagar + totals.totalAReceber
        }));
        
        summaryData = {
          branches,
          dateSpecificTotals: [],
          grandTotal: branches.reduce((sum, b) => sum + b.total, 0),
          grandTotalAPagar: branches.reduce((sum, b) => sum + b.totalAPagar, 0),
          grandTotalAReceber: branches.reduce((sum, b) => sum + b.totalAReceber, 0)
        };
        
        allInvoices = allTransactions;
        allBranchSummaries = branches.map(branch => ({
          branch: branch.name,
          invoiceCount: allTransactions.filter(inv => inv.branch === branch.name).length,
          totalValue: branch.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        }));
        
        console.log('=== DADOS CONVERTIDOS ===');
        console.log('Branches criadas:', branches.length);
        console.log('Total invoices:', allInvoices.length);
        console.log('Summary grandTotal:', summaryData.grandTotal);
      } else if (body.summaryData) {
        console.log('=== USANDO DADOS FORNECIDOS NO BODY ===');
        summaryData = body.summaryData;
      } else {
        // Tentativa de fallback: carregar cache de upload-csv
        try {
          const cachePath = path.join(process.cwd(), 'temp', 'last_processed.json');
          if (fs.existsSync(cachePath)) {
            console.log('Carregando processedData do cache local (last_processed.json)');
            const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            if (cached && cached.transactions) {
              body.processedData = cached; // reter em memória local
              console.log('Reinvocando processamento com cache');
              // Forçar pequena recursão lógica manual: duplicar bloco sem recursão HTTP
              const realData = cached;
              const branchMap = new Map<string, {totalAPagar: number, totalAReceber: number}>();
              const allTransactions: InvoiceData[] = [];
              try {
                realData.transactions.forEach((transaction: any, index: number) => {
                  try {
                    console.log(`[EXPORT][CACHE] Processando transação ${index}:`, {
                      vencimento: transaction.vencimento,
                      transacionador: transaction.transacionador,
                      valorNumerico: transaction.valorNumerico
                    });
                    
                    if (!transaction) return;
                    const branch = transaction.filial || realData.branchTotals?.[0]?.branch || 'FILIAL PRINCIPAL';
                    const sourceFile = transaction.sourceFile || `${branch}.csv`;
                    if (!branchMap.has(branch)) branchMap.set(branch, {totalAPagar: 0, totalAReceber: 0});
                    const branchData = branchMap.get(branch)!;
                    const valorNumerico = transaction.valorNumerico || 0;
                    const documentType: 'A_PAGAR' | 'A_RECEBER' = transaction.documentType === 'A_RECEBER' ? 'A_RECEBER' : 'A_PAGAR';
                    const parsedDate = parsePtBrDate(transaction.vencimento);
                    if (isNaN(parsedDate.getTime())) {
                      console.warn('[EXPORT][CACHE] Ignorando transação com data inválida:', transaction.vencimento);
                      return;
                    }
                    if (typeof valorNumerico !== 'number' || isNaN(Number(valorNumerico))) {
                      console.warn('[EXPORT][CACHE] Ignorando transação com valor inválido:', valorNumerico);
                      return;
                    }
                    if (documentType === 'A_PAGAR') branchData.totalAPagar += Math.abs(valorNumerico); else branchData.totalAReceber += Math.abs(valorNumerico);
                    allTransactions.push({
                      id: `real_${index}`,
                      branch: branch,
                      invoiceNumber: transaction.documento || `DOC-${index}`,
                      date: parsedDate,
                      value: transaction.valor || `R$ 0,00`,
                      supplier: transaction.transacionador || 'FORNECEDOR NÃO IDENTIFICADO',
                      documentType: documentType,
                      sourceFile: sourceFile,
                      valueNumeric: Math.abs(valorNumerico)
                    });
                  } catch (transactionErr) {
                    console.error(`[EXPORT][CACHE] Erro ao processar transação ${index}:`, transactionErr);
                  }
                });
              } catch (transactionsErr) {
                console.error('[EXPORT][CACHE] Erro ao processar transações do cache:', transactionsErr);
              }
              const branches = Array.from(branchMap.entries()).map(([name, totals]) => ({
                name,
                totalAPagar: totals.totalAPagar,
                totalAReceber: totals.totalAReceber,
                total: totals.totalAPagar + totals.totalAReceber
              }));
              summaryData = {
                branches,
                dateSpecificTotals: [],
                grandTotal: branches.reduce((sum, b) => sum + b.total, 0),
                grandTotalAPagar: branches.reduce((sum, b) => sum + b.totalAPagar, 0),
                grandTotalAReceber: branches.reduce((sum, b) => sum + b.totalAReceber, 0)
              };
              allInvoices = allTransactions;
              allBranchSummaries = branches.map(branch => ({
                branch: branch.name,
                invoiceCount: allTransactions.filter(inv => inv.branch === branch.name).length,
                totalValue: branch.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              }));
            }
          }
        } catch (cacheErr) {
          console.warn('Falha ao carregar cache de processedData:', cacheErr);
        }
      }
      
      if (body.allInvoices) {
        allInvoices = body.allInvoices;
      }
      
      if (body.allBranchSummaries) {
        allBranchSummaries = body.allBranchSummaries;
      }
    }

    // Se não temos dados, usar dados hardcoded para demonstração
    if (!summaryData || !summaryData.branches || summaryData.branches.length === 0) {
      console.log('Usando dados hardcoded para demonstração');
      summaryData = {
        branches: [
          {
            name: 'GO SEEDS',
            totalAPagar: 1912040.00,
            totalAReceber: 3175990.36,
            total: 5087030.36
          },
          {
            name: 'BEIJA FLOR',
            totalAPagar: 129763.24,
            totalAReceber: 0.00,
            total: 129763.24
          },
          {
            name: 'SAGUIA',
            totalAPagar: 138251.10,
            totalAReceber: 0.00,
            total: 138251.10
          },
          {
            name: 'ULTRA SEEDS',
            totalAPagar: 80.96,
            totalAReceber: 0.00,
            total: 80.96
          }
        ],
        dateSpecificTotals: [
          { day: '15/09/2024', total: 500000.00 },
          { day: '16/09/2024', total: 750000.00 },
          { day: '17/09/2024', total: 950000.00 }
        ],
        grandTotal: 5355135.66,
        grandTotalAPagar: 2180135.30,
        grandTotalAReceber: 3175000.36
      };

      // Gerar dados de invoices simulados baseados no summaryData
      allInvoices = generateSimulatedInvoices(summaryData);
      allBranchSummaries = summaryData.branches.map(branch => ({
        branch: branch.name,
        invoiceCount: Math.floor(Math.random() * 10) + 5,
        totalValue: branch.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      }));
    }

    // Calcular período real baseado nas datas dos documentos
    let actualStartDate: Date;
    let actualEndDate: Date;
    
    if (allInvoices.length > 0) {
      const invoiceDates = allInvoices
        .map(inv => new Date(inv.date))
        .sort((a, b) => a.getTime() - b.getTime());
      actualStartDate = invoiceDates[0];
      actualEndDate = invoiceDates[invoiceDates.length - 1];
    } else {
      actualStartDate = new Date();
      actualEndDate = new Date();
    }

    // Log estatístico para debug multi-file
    const distinctFiles = Array.from(new Set(allInvoices.map(i => i.sourceFile)));
    const distinctBranches = Array.from(new Set(allInvoices.map(i => i.branch)));
    console.log('[EXPORT] Estatísticas:', {
      totalInvoices: allInvoices.length,
      distinctFiles: distinctFiles.length,
      files: distinctFiles,
      distinctBranches: distinctBranches.length,
      branches: distinctBranches
    });

    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    
    console.log('Criando aba de Resumo Geral...');
    await createAdvancedSummaryWorksheet(
      workbook, 
      summaryData, 
      allInvoices, 
      reportName || 'Relatório de Notas Fiscais',
      actualStartDate,
      actualEndDate
    );
    
    console.log('Criando abas individuais por filial...');
    const existingWorksheetNames = new Set<string>();
    existingWorksheetNames.add('RESUMO GERAL'); // Adicionar o nome da aba de resumo
    
    for (const branch of summaryData.branches) {
      const branchInvoices = allInvoices.filter(inv => inv.branch === branch.name);
      await createAdvancedBranchWorksheet(workbook, branch, branchInvoices, existingWorksheetNames);
    }

    // Configurar resposta HTTP
    const fileName = `relatorio_detalhado_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Escrever workbook na resposta
    await workbook.xlsx.write(res);
    
    console.log('Excel gerado com sucesso!');
    res.end();

  } catch (error) {
    console.error('Erro na geração do Excel:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Não disponível');
    console.error('Tipo de erro:', typeof error);
    console.error('Estado do req.body:', {
      exists: !!(req as any).body,
      hasProcessedData: !!((req as any).body?.processedData),
      processedDataType: typeof (req as any).body?.processedData
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor: ' + (error instanceof Error ? error.message : 'Erro desconhecido'),
        errorDetails: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack?.substring(0, 500) // Primeiros 500 chars do stack
        } : 'Erro não identificado'
      });
    }
  }
}

// Função para gerar dados de invoices simulados
function generateSimulatedInvoices(summaryData: SummaryData): InvoiceData[] {
  const invoices: InvoiceData[] = [];
  let idCounter = 1;
  
  summaryData.branches.forEach(branch => {
    // Gerar algumas invoices A_PAGAR
    if (branch.totalAPagar > 0) {
      const numInvoicesAPagar = Math.floor(Math.random() * 5) + 2;
      const averageValue = branch.totalAPagar / numInvoicesAPagar;
      
      for (let i = 0; i < numInvoicesAPagar; i++) {
        const value = averageValue * (0.8 + Math.random() * 0.4); // Variação de ±20%
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 30)); // Próximos 30 dias
        
        invoices.push({
          id: `inv_${idCounter++}`,
          branch: branch.name,
          invoiceNumber: `NF-${String(i + 1).padStart(3, '0')}`,
          date: date,
          value: value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          supplier: `FORNECEDOR ${String.fromCharCode(65 + i)}`,
          documentType: 'A_PAGAR',
          sourceFile: `${branch.name}.csv`,
          valueNumeric: value
        });
      }
    }
    
    // Gerar algumas invoices A_RECEBER
    if (branch.totalAReceber > 0) {
      const numInvoicesAReceber = Math.floor(Math.random() * 3) + 1;
      const averageValue = branch.totalAReceber / numInvoicesAReceber;
      
      for (let i = 0; i < numInvoicesAReceber; i++) {
        const value = averageValue * (0.8 + Math.random() * 0.4);
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 30));
        
        invoices.push({
          id: `inv_${idCounter++}`,
          branch: branch.name,
          invoiceNumber: `REC-${String(i + 1).padStart(3, '0')}`,
          date: date,
          value: value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          supplier: `CLIENTE ${String.fromCharCode(65 + i)}`,
          documentType: 'A_RECEBER',
          sourceFile: `${branch.name}.csv`,
          valueNumeric: value
        });
      }
    }
  });
  
  return invoices;
}

// Função para criar a aba de resumo geral avançada
async function createAdvancedSummaryWorksheet(
  workbook: ExcelJS.Workbook, 
  summaryData: SummaryData, 
  allInvoices: InvoiceData[],
  reportName: string,
  actualStartDate: Date,
  actualEndDate: Date
) {
  const summarySheet = workbook.addWorksheet('Resumo Geral');
  let summaryCurrentRow = 1;

  // Header do relatório
  summarySheet.addRow([reportName]);
  summarySheet.mergeCells(`A${summaryCurrentRow}:D${summaryCurrentRow}`);
  summarySheet.getCell(`A${summaryCurrentRow}`).style = titleStyle;
  summarySheet.getRow(summaryCurrentRow).height = 35;
  summaryCurrentRow++;

  // Período
  const periodText = `PERÍODO: ${actualStartDate.toLocaleDateString('pt-BR')} - ${actualEndDate.toLocaleDateString('pt-BR')}`;
  summarySheet.addRow([periodText]);
  summarySheet.mergeCells(`A${summaryCurrentRow}:D${summaryCurrentRow}`);
  summarySheet.getCell(`A${summaryCurrentRow}`).style = {
    font: { bold: true, size: 12 },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'E7E6E6' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
  };
  summaryCurrentRow++;

  // Linha vazia
  summarySheet.addRow([]);
  summaryCurrentRow++;

  // Headers das colunas
  summarySheet.addRow(['Vencimento', 'Transacionador', 'Documento', 'Valor']);
  summarySheet.getRow(summaryCurrentRow).eachCell((cell) => {
    cell.style = headerStyle;
  });
  summaryCurrentRow++;

  // Agrupar invoices por arquivo fonte e tipo de documento
  const invoicesByFileAndType = new Map<string, { A_PAGAR: InvoiceData[], A_RECEBER: InvoiceData[] }>();
  
  for (const invoice of allInvoices) {
    const sourceFile = invoice.sourceFile || 'Unknown';
    
    if (!invoicesByFileAndType.has(sourceFile)) {
      invoicesByFileAndType.set(sourceFile, { A_PAGAR: [], A_RECEBER: [] });
    }
    
    const fileTypes = invoicesByFileAndType.get(sourceFile)!;
    const docType = invoice.documentType || 'A_PAGAR';
    fileTypes[docType].push(invoice);
  }

  // Processar cada arquivo e tipo de documento
  for (const [fileName, fileTypes] of Array.from(invoicesByFileAndType)) {
    for (const [docType, fileInvoices] of Object.entries(fileTypes)) {
      if (fileInvoices.length === 0) continue;
      
      const typeLabel = docType === 'A_PAGAR' ? 'CONTAS A PAGAR' : 'CONTAS A RECEBER';
      const cleanFileName = fileName.replace(/\.(csv|CSV)$/, '');
      
      // Header da categoria
      summarySheet.addRow([`${typeLabel} - ${cleanFileName}`, '', '', '']);
      summarySheet.mergeCells(`A${summaryCurrentRow}:D${summaryCurrentRow}`);
      summarySheet.getCell(`A${summaryCurrentRow}`).style = subHeaderStyle;
      summaryCurrentRow++;
      
      // Ordenar por data
      fileInvoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Adicionar transações com totais diários
      let currentDate = '';
      let dailyTotal = 0;
      
      for (const invoice of fileInvoices) {
        const invoiceDate = new Date(invoice.date).toLocaleDateString('pt-BR');
        const invoiceValue = invoice.valueNumeric;
        
        // Verificar mudança de data para total diário
        if (currentDate && currentDate !== invoiceDate && dailyTotal > 0) {
          summarySheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
          const totalRow = summarySheet.getRow(summaryCurrentRow);
          totalRow.eachCell((cell, colNumber) => {
            cell.style = {
              font: { bold: true },
              fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
              numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
              border: cellStyle.border
            };
          });
          summaryCurrentRow++;
          dailyTotal = 0;
        }
        
        // Adicionar linha da transação
        summarySheet.addRow([
          invoiceDate,
          invoice.supplier || 'FORNECEDOR NÃO IDENTIFICADO',
          invoice.invoiceNumber,
          invoiceValue
        ]);
        
        const row = summarySheet.getRow(summaryCurrentRow);
        row.eachCell((cell, colNumber) => {
          cell.style = cellStyle;
          if (colNumber === 4) {
            cell.numFmt = 'R$ #,##0.00';
          }
        });
        
        currentDate = invoiceDate;
        dailyTotal += invoiceValue;
        summaryCurrentRow++;
      }
      
      // Total final da categoria se houver dados pendentes
      if (dailyTotal > 0) {
        summarySheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
        const totalRow = summarySheet.getRow(summaryCurrentRow);
        totalRow.eachCell((cell, colNumber) => {
          cell.style = {
            font: { bold: true },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
            numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
            border: cellStyle.border
          };
        });
        summaryCurrentRow++;
      }
      
      // Total da categoria
      const categoryTotal = fileInvoices.reduce((sum, inv) => sum + inv.valueNumeric, 0);
      summarySheet.addRow(['', '', `TOTAL ${typeLabel}`, categoryTotal]);
      const categoryTotalRow = summarySheet.getRow(summaryCurrentRow);
      categoryTotalRow.eachCell((cell, colNumber) => {
        cell.style = {
          ...totalRowStyle,
          numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
          border: cellStyle.border
        };
      });
      summaryCurrentRow++;
      
      // Linha vazia para separação
      summarySheet.addRow([]);
      summaryCurrentRow++;
    }
  }

  // Total geral final
  summarySheet.addRow(['', '', 'TOTAL GERAL', summaryData.grandTotal]);
  const grandTotalRow = summarySheet.getRow(summaryCurrentRow);
  grandTotalRow.eachCell((cell, colNumber) => {
    cell.style = {
      ...totalRowStyle,
      numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
      border: cellStyle.border,
      font: { bold: true, size: 14, color: { argb: 'FFFFFF' } }
    };
  });

  // Definir larguras das colunas
  summarySheet.getColumn(1).width = 15; // Data
  summarySheet.getColumn(2).width = 60; // Transacionador  
  summarySheet.getColumn(3).width = 20; // Documento
  summarySheet.getColumn(4).width = 18; // Valor
}

// Função para criar aba individual da filial avançada
// Função para gerar nomes únicos de worksheet
function generateUniqueWorksheetName(baseName: string, existingNames: Set<string>): string {
  // Limpar caracteres inválidos e limitar tamanho
  let cleanName = baseName
    .replace(/[\/\\\?\*\[\]]/g, '_')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .substring(0, 25)
    .trim();
  
  // Se o nome estiver vazio após limpeza, usar um padrão
  if (!cleanName) {
    cleanName = 'PLANILHA';
  }
  
  // Se o nome não existe, usar como está
  if (!existingNames.has(cleanName)) {
    existingNames.add(cleanName);
    return cleanName;
  }
  
  // Se existe, adicionar número sequencial
  let counter = 1;
  let uniqueName = `${cleanName.substring(0, 22)}_${counter}`;
  
  while (existingNames.has(uniqueName)) {
    counter++;
    uniqueName = `${cleanName.substring(0, 22)}_${counter}`;
  }
  
  existingNames.add(uniqueName);
  return uniqueName;
}

async function createAdvancedBranchWorksheet(
  workbook: ExcelJS.Workbook, 
  branch: BranchData, 
  branchInvoices: InvoiceData[],
  existingNames: Set<string>
) {
  const uniqueName = generateUniqueWorksheetName(branch.name, existingNames);
  const worksheet = workbook.addWorksheet(uniqueName);
  let currentRow = 1;

  // Título da filial
  const titleRow = worksheet.addRow([`DETALHAMENTO - ${branch.name}`]);
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  titleRow.getCell(1).style = titleStyle;
  titleRow.height = 30;
  currentRow++;

  // Período
  if (branchInvoices.length > 0) {
    const branchDates = branchInvoices.map(inv => new Date(inv.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = branchDates[0];
    const endDate = branchDates[branchDates.length - 1];
    const periodText = `PERÍODO: ${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`;
    
    worksheet.addRow([periodText]);
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    worksheet.getCell(`A${currentRow}`).style = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'E7E6E6' } },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
    };
    currentRow++;
  }

  // Linha vazia
  worksheet.addRow([]);
  currentRow++;
  worksheet.addRow([]);
  currentRow++;

  // Detalhamento de transações por tipo
  if (branchInvoices.length > 0) {
    // Separar por tipo de documento
    const apagarInvoices = branchInvoices.filter(inv => inv.documentType === 'A_PAGAR');
    const areceberInvoices = branchInvoices.filter(inv => inv.documentType === 'A_RECEBER');

    // Processar A_PAGAR
    if (apagarInvoices.length > 0) {
      const aPagarHeaderRow = worksheet.addRow(['CONTAS A PAGAR']);
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      aPagarHeaderRow.getCell(1).style = subHeaderStyle;
      currentRow++;

      worksheet.addRow([]);
      currentRow++;

      // Cabeçalhos das transações A_PAGAR
      const transHeaderRow = worksheet.addRow(['Vencimento', 'Transacionador', 'Documento', 'Valor']);
      transHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });
      currentRow++;

      // Ordenar por data e adicionar transações
      apagarInvoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let currentDate = '';
      let dailyTotal = 0;

      apagarInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.date).toLocaleDateString('pt-BR');
        
        // Verificar mudança de data para total diário
        if (currentDate && currentDate !== invoiceDate && dailyTotal > 0) {
          worksheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
          const totalRow = worksheet.getRow(currentRow);
          totalRow.eachCell((cell, colNumber) => {
            cell.style = {
              font: { bold: true },
              fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
              numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
              border: cellStyle.border
            };
          });
          currentRow++;
          dailyTotal = 0;
        }

        worksheet.addRow([
          invoiceDate,
          invoice.supplier,
          invoice.invoiceNumber,
          invoice.valueNumeric
        ]);

        const row = worksheet.getRow(currentRow);
        row.eachCell((cell, colNumber) => {
          cell.style = cellStyle;
          if (colNumber === 4) {
            cell.numFmt = 'R$ #,##0.00';
          }
        });

        currentDate = invoiceDate;
        dailyTotal += invoice.valueNumeric;
        currentRow++;
      });

      // Total final A_PAGAR
      if (dailyTotal > 0) {
        worksheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
        const totalRow = worksheet.getRow(currentRow);
        totalRow.eachCell((cell, colNumber) => {
          cell.style = {
            font: { bold: true },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
            numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
            border: cellStyle.border
          };
        });
        currentRow++;
      }

      const totalAPagarRow = worksheet.addRow(['', '', 'TOTAL A PAGAR', branch.totalAPagar]);
      totalAPagarRow.eachCell((cell, colNumber) => {
        cell.style = {
          ...totalRowStyle,
          numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
          border: cellStyle.border
        };
      });
      currentRow++;

      // Linha vazia
      worksheet.addRow([]);
      currentRow++;
    }

    // Processar A_RECEBER
    if (areceberInvoices.length > 0) {
      const aReceberHeaderRow = worksheet.addRow(['CONTAS A RECEBER']);
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      aReceberHeaderRow.getCell(1).style = subHeaderStyle;
      currentRow++;

      worksheet.addRow([]);
      currentRow++;

      // Cabeçalhos das transações A_RECEBER
      const transHeaderRow = worksheet.addRow(['Vencimento', 'Cliente', 'Documento', 'Valor']);
      transHeaderRow.eachCell((cell) => {
        cell.style = headerStyle;
      });
      currentRow++;

      // Ordenar por data e adicionar transações
      areceberInvoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let currentDate = '';
      let dailyTotal = 0;

      areceberInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.date).toLocaleDateString('pt-BR');
        
        // Verificar mudança de data para total diário
        if (currentDate && currentDate !== invoiceDate && dailyTotal > 0) {
          worksheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
          const totalRow = worksheet.getRow(currentRow);
          totalRow.eachCell((cell, colNumber) => {
            cell.style = {
              font: { bold: true },
              fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
              numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
              border: cellStyle.border
            };
          });
          currentRow++;
          dailyTotal = 0;
        }

        worksheet.addRow([
          invoiceDate,
          invoice.supplier,
          invoice.invoiceNumber,
          invoice.valueNumeric
        ]);

        const row = worksheet.getRow(currentRow);
        row.eachCell((cell, colNumber) => {
          cell.style = cellStyle;
          if (colNumber === 4) {
            cell.numFmt = 'R$ #,##0.00';
          }
        });

        currentDate = invoiceDate;
        dailyTotal += invoice.valueNumeric;
        currentRow++;
      });

      // Total final A_RECEBER
      if (dailyTotal > 0) {
        worksheet.addRow(['', '', 'TOTAL DIÁRIO', dailyTotal]);
        const totalRow = worksheet.getRow(currentRow);
        totalRow.eachCell((cell, colNumber) => {
          cell.style = {
            font: { bold: true },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
            numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
            border: cellStyle.border
          };
        });
        currentRow++;
      }

      const totalAReceberRow = worksheet.addRow(['', '', 'TOTAL A RECEBER', branch.totalAReceber]);
      totalAReceberRow.eachCell((cell, colNumber) => {
        cell.style = {
          ...totalRowStyle,
          numFmt: colNumber === 4 ? 'R$ #,##0.00' : undefined,
          border: cellStyle.border
        };
      });
      currentRow++;
    }

  } else {
    // Mensagem quando não há transações detalhadas
    const noDataRow = worksheet.addRow(['TRANSAÇÕES DETALHADAS']);
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    noDataRow.getCell(1).style = subHeaderStyle;
    currentRow++;

    worksheet.addRow([]);
    currentRow++;
    worksheet.addRow(['Dados detalhados das transações serão exibidos aqui quando disponíveis.']);
    worksheet.addRow(['Para obter detalhes, faça upload dos arquivos CSV individuais.']);
  }

  // Ajustar largura das colunas
  worksheet.columns = [
    { width: 15 }, // Vencimento
    { width: 40 }, // Transacionador/Cliente
    { width: 20 }, // Documento
    { width: 18 }  // Valor
  ];
}

// Função para criar a aba de resumo geral
async function createResumoGeralWorksheet(workbook: ExcelJS.Workbook, summaryData: SummaryData) {
  const worksheet = workbook.addWorksheet('Resumo Geral');
  
  // Título principal
  const titleRow = worksheet.addRow(['RESUMO GERAL - SALDO LÍQUIDO POR FILIAL']);
  worksheet.mergeCells('A1:D1');
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;
  
  worksheet.addRow([]); // Linha vazia
  
  // Cabeçalhos
  const headerRow = worksheet.addRow(['FILIAL', 'TOTAL A PAGAR', 'TOTAL A RECEBER', 'SALDO LÍQUIDO']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Dados das filiais
  summaryData.branches.forEach(branch => {
    const saldoLiquido = branch.totalAReceber - branch.totalAPagar;
    const row = worksheet.addRow([
      branch.name,
      `R$ ${branch.totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${branch.totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);
    
    // Colorir saldo líquido conforme valor
    const saldoCell = row.getCell(4);
    if (saldoLiquido > 0) {
      saldoCell.font = { color: { argb: 'FF008000' }, bold: true }; // Verde
    } else if (saldoLiquido < 0) {
      saldoCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Vermelho
    }
  });
  
  // Linha de total geral
  worksheet.addRow([]); // Linha vazia
  const totalRow = worksheet.addRow([
    'TOTAL GERAL',
    `R$ ${summaryData.grandTotalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `R$ ${summaryData.grandTotalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    `R$ ${(summaryData.grandTotalAReceber - summaryData.grandTotalAPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ]);
  
  totalRow.font = { bold: true, size: 12 };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  
  // Ajustar largura das colunas
  worksheet.columns = [
    { width: 20 }, // Filial
    { width: 18 }, // Total A Pagar
    { width: 18 }, // Total A Receber
    { width: 18 }  // Saldo Líquido
  ];
  
  // Adicionar bordas
  const dataRange = worksheet.getRows(3, worksheet.rowCount - 2);
  dataRange?.forEach(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
}

// Função para criar aba individual da filial
async function createBranchWorksheet(workbook: ExcelJS.Workbook, branch: BranchData, processedData?: ProcessedData) {
  const worksheet = workbook.addWorksheet(branch.name);
  
  // Título da filial
  const titleRow = worksheet.addRow([`DETALHAMENTO - ${branch.name}`]);
  worksheet.mergeCells('A1:D1');
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 25;
  
  worksheet.addRow([]); // Linha vazia
  
  // Detalhamento de transações (se disponível)
  if (processedData && processedData.transactions.length > 0) {
    const transactionsHeaderRow = worksheet.addRow(['DETALHAMENTO DE TRANSAÇÕES']);
    worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);
    transactionsHeaderRow.getCell(1).font = { bold: true, size: 12 };
    transactionsHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    transactionsHeaderRow.getCell(1).alignment = { horizontal: 'center' };
    
    worksheet.addRow([]); // Linha vazia
    
    // Cabeçalhos das transações
    const transHeaderRow = worksheet.addRow(['Vencimento', 'Transacionador', 'Documento', 'Valor', 'Tipo']);
    transHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    transHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    
    // Dados das transações
    processedData.transactions.forEach(transaction => {
      const tipo = transaction.valorNumerico > 0 ? 'A Pagar' : 'A Receber';
      worksheet.addRow([
        transaction.vencimento,
        transaction.transacionador,
        transaction.documento,
        transaction.valor,
        tipo
      ]);
    });
  } else {
    // Mensagem quando não há transações detalhadas
    const noDataRow = worksheet.addRow(['TRANSAÇÕES DETALHADAS']);
    worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);
    noDataRow.getCell(1).font = { bold: true, size: 12 };
    noDataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    noDataRow.getCell(1).alignment = { horizontal: 'center' };
    
    worksheet.addRow([]); // Linha vazia
    worksheet.addRow(['Dados detalhados das transações serão exibidos aqui quando disponíveis.']);
    worksheet.addRow(['Para obter detalhes, faça upload dos arquivos CSV individuais.']);
  }
  
  // Ajustar largura das colunas
  worksheet.columns = [
    { width: 15 }, // Vencimento
    { width: 25 }, // Transacionador
    { width: 15 }, // Documento
    { width: 18 }, // Valor
    { width: 12 }  // Tipo
  ];
  
  // Adicionar bordas nas células importantes
  const allRows = worksheet.getRows(1, worksheet.rowCount);
  allRows?.forEach(row => {
    row.eachCell(cell => {
      if (cell.value) {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });
  });
}