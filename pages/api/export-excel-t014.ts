import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'

// Interfaces vindas do upload-csv-t014
interface T014Transaction {
  data: string;
  documento: string;
  favorecido: string;
  descricao: string;
  numeroDocumento: string;
  valor: number;
  valorFormatado: string;
  tipo: 'A_RECEBER' | 'A_PAGAR';
  filial: string;
}

interface T014ProcessedData {
  filial: string;
  transacoes: T014Transaction[];
  totalAPagar: number;
  totalAReceber: number;
  saldoLiquido: number;
}

interface T014SummaryData {
  filiais: T014ProcessedData[];
  totalGeralAPagar: number;
  totalGeralAReceber: number;
  saldoGeralLiquido: number;
  periodo: string;
}

// Função para formatar valores monetários
function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// Função para criar aba de resumo geral
function createT014SummarySheet(workbook: ExcelJS.Workbook, data: T014SummaryData) {
  const worksheet = workbook.addWorksheet('RESUMO GERAL');
  
  // Título principal
  const titleRow = worksheet.addRow(['RELATÓRIO DE FLUXO DE CAIXA - RESUMO GERAL']);
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.mergeCells(`A${titleRow.number}:D${titleRow.number}`);
  
  // Período
  const periodoRow = worksheet.addRow([`PERÍODO: ${data.periodo}`]);
  periodoRow.getCell(1).font = { bold: true, size: 12 };
  worksheet.mergeCells(`A${periodoRow.number}:D${periodoRow.number}`);
  
  worksheet.addRow([]);
  
  // Cabeçalhos
  const headerRow = worksheet.addRow(['FILIAL', 'TOTAL A PAGAR', 'TOTAL A RECEBER', 'SALDO LÍQUIDO', 'QTD TRANSAÇÕES']);
  headerRow.eachCell((cell) => {
    cell.style = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      },
      alignment: { horizontal: 'center' }
    };
  });
  
  // Dados das filiais
  data.filiais.forEach(filial => {
    const row = worksheet.addRow([
      filial.filial,
      filial.totalAPagar,
      filial.totalAReceber,
      filial.saldoLiquido,
      filial.transacoes.length
    ]);
    
    row.eachCell((cell, colNumber) => {
      cell.style = {
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      if (colNumber >= 2 && colNumber <= 4) {
        cell.numFmt = 'R$ #,##0.00';
      }
    });
  });
  
  // Totais
  const totalRow = worksheet.addRow([
    'TOTAL GERAL',
    data.totalGeralAPagar,
    data.totalGeralAReceber,
    data.saldoGeralLiquido,
    data.filiais.reduce((sum, f) => sum + f.transacoes.length, 0)
  ]);
  
  totalRow.eachCell((cell, colNumber) => {
    cell.style = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
    
    if (colNumber >= 2 && colNumber <= 4) {
      cell.numFmt = 'R$ #,##0.00';
    }
  });
  
  // Ajustar largura das colunas
  worksheet.columns = [
    { width: 25 }, // Filial
    { width: 18 }, // Total A Pagar
    { width: 18 }, // Total A Receber
    { width: 18 }, // Saldo Líquido
    { width: 18 }  // Quantidade
  ];
}

// Função para criar aba de filial específica
function createT014BranchSheet(workbook: ExcelJS.Workbook, filialData: T014ProcessedData) {
  const worksheet = workbook.addWorksheet(filialData.filial);
  
  // Título da filial
  const titleRow = worksheet.addRow([`DETALHAMENTO - ${filialData.filial}`]);
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
  
  worksheet.addRow([]);
  
  // Separar transações por tipo
  const contasAPagar = filialData.transacoes.filter(t => t.tipo === 'A_PAGAR');
  const contasAReceber = filialData.transacoes.filter(t => t.tipo === 'A_RECEBER');
  
  // Seção CONTAS A PAGAR
  if (contasAPagar.length > 0) {
    const aPagarTitleRow = worksheet.addRow(['CONTAS A PAGAR']);
    aPagarTitleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    aPagarTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC3545' } };
    worksheet.mergeCells(`A${aPagarTitleRow.number}:F${aPagarTitleRow.number}`);
    
    worksheet.addRow([]);
    
    // Cabeçalhos A PAGAR
    const headerAPagar = worksheet.addRow(['Data', 'Favorecido', 'Documento', 'Nº Documento', 'Descrição', 'Valor']);
    headerAPagar.eachCell((cell) => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C757D' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    });
    
    // Dados A PAGAR
    contasAPagar.forEach(transacao => {
      const row = worksheet.addRow([
        transacao.data,
        transacao.favorecido,
        transacao.documento,
        transacao.numeroDocumento,
        transacao.descricao,
        transacao.valor
      ]);
      
      row.eachCell((cell, colNumber) => {
        cell.style = {
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
        
        if (colNumber === 6) {
          cell.numFmt = 'R$ #,##0.00';
        }
      });
    });
    
    // Total A PAGAR
    const totalAPagarRow = worksheet.addRow(['', '', '', '', 'TOTAL A PAGAR', filialData.totalAPagar]);
    totalAPagarRow.eachCell((cell, colNumber) => {
      cell.style = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      if (colNumber === 6) {
        cell.numFmt = 'R$ #,##0.00';
      }
    });
    
    worksheet.addRow([]);
    worksheet.addRow([]);
  }
  
  // Seção CONTAS A RECEBER
  if (contasAReceber.length > 0) {
    const aReceberTitleRow = worksheet.addRow(['CONTAS A RECEBER']);
    aReceberTitleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    aReceberTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28A745' } };
    worksheet.mergeCells(`A${aReceberTitleRow.number}:F${aReceberTitleRow.number}`);
    
    worksheet.addRow([]);
    
    // Cabeçalhos A RECEBER
    const headerAReceber = worksheet.addRow(['Data', 'Cliente', 'Documento', 'Nº Documento', 'Descrição', 'Valor']);
    headerAReceber.eachCell((cell) => {
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C757D' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    });
    
    // Dados A RECEBER
    contasAReceber.forEach(transacao => {
      const row = worksheet.addRow([
        transacao.data,
        transacao.favorecido,
        transacao.documento,
        transacao.numeroDocumento,
        transacao.descricao,
        transacao.valor
      ]);
      
      row.eachCell((cell, colNumber) => {
        cell.style = {
          border: {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
        
        if (colNumber === 6) {
          cell.numFmt = 'R$ #,##0.00';
        }
      });
    });
    
    // Total A RECEBER
    const totalAReceberRow = worksheet.addRow(['', '', '', '', 'TOTAL A RECEBER', filialData.totalAReceber]);
    totalAReceberRow.eachCell((cell, colNumber) => {
      cell.style = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7E6' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      
      if (colNumber === 6) {
        cell.numFmt = 'R$ #,##0.00';
      }
    });
  }
  
  // Ajustar largura das colunas
  worksheet.columns = [
    { width: 12 }, // Data
    { width: 40 }, // Favorecido/Cliente
    { width: 15 }, // Documento
    { width: 15 }, // Nº Documento
    { width: 25 }, // Descrição
    { width: 18 }  // Valor
  ];
}

// Função principal para gerar Excel T014
async function generateT014Excel(data: T014SummaryData, res: NextApiResponse) {
  try {
    console.log('Criando workbook T014...');
    const workbook = new ExcelJS.Workbook();
    
    // Criar aba de resumo
    createT014SummarySheet(workbook, data);
    
    // Criar aba para cada filial
    data.filiais.forEach(filial => {
      createT014BranchSheet(workbook, filial);
    });
    
    // Configurar resposta HTTP
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio_t014_fluxo_caixa_${new Date().toISOString().split('T')[0]}.xlsx"`
    );
    
    // Enviar arquivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erro ao gerar Excel T014:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('=== EXPORT EXCEL T014 ===');
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        success: false,
        message: 'Método não permitido' 
      });
    }

    // Obter dados do corpo da requisição
    const { data } = req.body as { data: T014SummaryData };
    
    if (!data || !data.filiais || data.filiais.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados T014 não encontrados ou inválidos'
      });
    }
    
    console.log('Gerando Excel T014 com dados:', {
      totalFiliais: data.filiais.length,
      periodo: data.periodo
    });
    
    await generateT014Excel(data, res);
    
    console.log('Excel T014 gerado com sucesso!');
    
  } catch (error) {
    console.error('Erro ao processar requisição T014:', error);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: (error as Error).message
      });
    }
  }
}