import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

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

// Interface para dados processados de transações individuais
interface TransactionData {
  vencimento: string
  transacionador: string
  documento: string
  valor: string
  valorNumerico: number
  tipo: 'A_PAGAR' | 'A_RECEBER'
}

interface ProcessedData {
  branch: string;
  transactions: TransactionData[];
  totalAPagar: number;
  totalAReceber: number;
  summary: BranchData;
}

// Função para formatar valores monetários
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// Função para criar aba de resumo geral
function createSummarySheet(workbook: ExcelJS.Workbook, summaryData: SummaryData) {
  const worksheet = workbook.addWorksheet('Resumo Geral');
  
  // Título principal
  const titleRow = worksheet.addRow(['RELATÓRIO CONSOLIDADO - SALDO LÍQUIDO POR FILIAL']);
  worksheet.mergeCells('A1:D1');
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;
  
  worksheet.addRow([]); // Linha vazia
  
  // Cabeçalhos
  const headerRow = worksheet.addRow(['Filial', 'Total A Pagar', 'Total A Receber', 'Saldo Líquido']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.height = 25;
  
  // Dados das filiais
  summaryData.branches.forEach(branch => {
    const saldoLiquido = branch.totalAReceber - branch.totalAPagar;
    worksheet.addRow([
      branch.name,
      formatCurrency(branch.totalAPagar),
      formatCurrency(branch.totalAReceber),
      formatCurrency(saldoLiquido)
    ]);
  });
  
  // Total geral
  const grandSaldoLiquido = summaryData.grandTotalAReceber - summaryData.grandTotalAPagar;
  const totalRow = worksheet.addRow([
    'TOTAL GERAL',
    formatCurrency(summaryData.grandTotalAPagar),
    formatCurrency(summaryData.grandTotalAReceber),
    formatCurrency(grandSaldoLiquido)
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  
  // Configurar larguras das colunas
  worksheet.columns = [
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 20 }
  ];
  
  // Aplicar bordas
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  return worksheet;
}

// Função para criar aba individual da filial
function createBranchSheet(workbook: ExcelJS.Workbook, branchData: ProcessedData) {
  const worksheet = workbook.addWorksheet(branchData.branch);
  
  // Título da filial
  const titleRow = worksheet.addRow([`FLUXO DE CAIXA - ${branchData.branch.toUpperCase()}`]);
  worksheet.mergeCells('A1:D1');
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 25;
  
  worksheet.addRow([]); // Linha vazia
  
  // Seção CONTAS A PAGAR
  const contasAPagarTitle = worksheet.addRow(['CONTAS A PAGAR']);
  worksheet.mergeCells(`A${contasAPagarTitle.number}:D${contasAPagarTitle.number}`);
  contasAPagarTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
  contasAPagarTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  contasAPagarTitle.getCell(1).alignment = { horizontal: 'center' };
  
  // Cabeçalhos A PAGAR
  const headerAPagar = worksheet.addRow(['Vencimento', 'Transacionador', 'Documento', 'Valor']);
  headerAPagar.font = { bold: true };
  headerAPagar.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
  
  // Dados A PAGAR
  const contasAPagar = branchData.transactions.filter(t => t.tipo === 'A_PAGAR');
  contasAPagar.forEach(transacao => {
    worksheet.addRow([
      transacao.vencimento,
      transacao.transacionador,
      transacao.documento,
      transacao.valor
    ]);
  });
  
  // Total A PAGAR
  const totalAPagarRow = worksheet.addRow(['', '', 'TOTAL A PAGAR', formatCurrency(branchData.totalAPagar)]);
  totalAPagarRow.font = { bold: true };
  totalAPagarRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
  
  worksheet.addRow([]); // Linha vazia
  
  // Seção CONTAS A RECEBER
  const contasAReceberTitle = worksheet.addRow(['CONTAS A RECEBER']);
  worksheet.mergeCells(`A${contasAReceberTitle.number}:D${contasAReceberTitle.number}`);
  contasAReceberTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4ECDC4' } };
  contasAReceberTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  contasAReceberTitle.getCell(1).alignment = { horizontal: 'center' };
  
  // Cabeçalhos A RECEBER
  const headerAReceber = worksheet.addRow(['Vencimento', 'Transacionador', 'Documento', 'Valor']);
  headerAReceber.font = { bold: true };
  headerAReceber.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7F5' } };
  
  // Dados A RECEBER
  const contasAReceber = branchData.transactions.filter(t => t.tipo === 'A_RECEBER');
  contasAReceber.forEach(transacao => {
    worksheet.addRow([
      transacao.vencimento,
      transacao.transacionador,
      transacao.documento,
      transacao.valor
    ]);
  });
  
  // Total A RECEBER
  const totalAReceberRow = worksheet.addRow(['', '', 'TOTAL A RECEBER', formatCurrency(branchData.totalAReceber)]);
  totalAReceberRow.font = { bold: true };
  totalAReceberRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
  
  worksheet.addRow([]); // Linha vazia
  
  // SALDO LÍQUIDO
  const saldoLiquido = branchData.totalAReceber - branchData.totalAPagar;
  const saldoRow = worksheet.addRow(['', '', 'SALDO LÍQUIDO', formatCurrency(saldoLiquido)]);
  saldoRow.font = { bold: true, size: 12 };
  saldoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: saldoLiquido >= 0 ? 'FF90EE90' : 'FFFFA07A' } };
  
  // Configurar larguras das colunas
  worksheet.columns = [
    { width: 15 },
    { width: 25 },
    { width: 20 },
    { width: 18 }
  ];
  
  // Aplicar bordas
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  return worksheet;
}

// Função principal para gerar Excel com abas por filial
async function generateExcelWithBranches(processedData: ProcessedData[], summaryData: SummaryData, res: NextApiResponse) {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Criar aba de resumo geral
    createSummarySheet(workbook, summaryData);
    
    // Criar aba para cada filial
    processedData.forEach(branchData => {
      createBranchSheet(workbook, branchData);
    });
    
    // Configurar resposta HTTP
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio_fluxo_caixa_filiais_${new Date().toISOString().split('T')[0]}.xlsx"`
    );
    
    // Enviar arquivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    throw error;
  }
}

// Função hardcoded temporária para demonstração
function getHardcodedData(): { processedData: ProcessedData[], summaryData: SummaryData } {
  const summaryData: SummaryData = {
    branches: [
      { name: 'GO SEEDS', totalAPagar: 1912040.00, totalAReceber: 3175990.36, total: 5088030.36 },
      { name: 'BEIJA FLOR', totalAPagar: 129763.24, totalAReceber: 0.00, total: 129763.24 },
      { name: 'SAGUIA', totalAPagar: 138251.10, totalAReceber: 0.00, total: 138251.10 },
      { name: 'ULTRA SEEDS', totalAPagar: 80.96, totalAReceber: 0.00, total: 80.96 }
    ],
    dateSpecificTotals: [
      { day: '01/09/2024', total: 150000.00 },
      { day: '02/09/2024', total: 230000.50 }
    ],
    grandTotal: 5356125.66,
    grandTotalAPagar: 2180135.30,
    grandTotalAReceber: 3175990.36
  };
  
  const processedData: ProcessedData[] = summaryData.branches.map(branch => ({
    branch: branch.name,
    transactions: [
      {
        vencimento: '15/09/2024',
        transacionador: 'Fornecedor XYZ',
        documento: 'NF001',
        valor: formatCurrency(branch.totalAPagar / 2),
        valorNumerico: branch.totalAPagar / 2,
        tipo: 'A_PAGAR' as const
      },
      {
        vencimento: '20/09/2024',
        transacionador: 'Cliente ABC',
        documento: 'REC001',
        valor: formatCurrency(branch.totalAReceber),
        valorNumerico: branch.totalAReceber,
        tipo: 'A_RECEBER' as const
      }
    ],
    totalAPagar: branch.totalAPagar,
    totalAReceber: branch.totalAReceber,
    summary: branch
  }));
  
  return { processedData, summaryData };
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
  console.log('Iniciando geração do Excel...');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Por enquanto, usando dados hardcoded para demonstração
    // TODO: Integrar com dados reais do upload-csv.ts e upload-csv-summary.ts
    console.log('Nenhum arquivo CSV encontrado, usando dados hardcoded');
    
    const { processedData, summaryData } = getHardcodedData();
    
    await generateExcelWithBranches(processedData, summaryData, res);
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}