import type { NextApiRequest, NextApiResponse } from 'next'
import * as ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'
import { getSummaryData } from './upload-csv-summary'
import { DadosResumo, ResumoFilial } from '../../lib/resumo-processor'

// Estilos padronizados para Excel
const borderStyle = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const }
};

const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  border: borderStyle
};

const cellStyle = {
  border: borderStyle,
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F8F9FA' } }
};

const totalRowStyle = {
  font: { bold: true, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '366092' } },
  alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  border: borderStyle
};

// FUNÇÃO PRINCIPAL DE GERAÇÃO EXCEL
async function gerarExcelResumo(summaryData: DadosResumo): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Resumo Total das Filiais');
  
  let currentRow = 1;
  
  // SEÇÃO 1: CABEÇALHO PRINCIPAL
  adicionarTituloPrincipal(sheet, currentRow++, 'RESUMO TOTAL DAS FILIAIS');
  currentRow++; // Linha vazia
  
  // SEÇÃO 2: TABELA DE FILIAIS
  adicionarCabecalhoTabela(sheet, currentRow++, ['Filial', 'Total A Pagar', 'Total A Receber']);
  
  for (const branch of summaryData.branches) {
    adicionarLinhaFilial(sheet, currentRow++, branch, cellStyle);
  }
  
  currentRow++; // Linha vazia
  
  // SEÇÃO 3: TOTAIS GERAIS
  adicionarTotalGeral(sheet, currentRow++, 'TOTAL GERAL A PAGAR', summaryData.grandTotalAPagar);
  adicionarTotalGeral(sheet, currentRow++, 'TOTAL GERAL A RECEBER', summaryData.grandTotalAReceber);
  adicionarTotalGeral(sheet, currentRow++, 'TOTAL GERAL', summaryData.grandTotal);
  
  currentRow++; // Linha vazia
  
  // SEÇÃO 4: TOTAIS POR DATA (se disponível)
  if (summaryData.dateSpecificTotals.length > 0) {
    adicionarSecaoTotaisPorData(sheet, currentRow, summaryData.dateSpecificTotals);
  }
  
  // FORMATAÇÃO FINAL
  formatarColunas(sheet);
  
  return workbook;
}

// FUNÇÕES DE FORMATAÇÃO ESPECÍFICAS
function adicionarTituloPrincipal(sheet: ExcelJS.Worksheet, row: number, titulo: string) {
  sheet.addRow([titulo, '', '']);
  sheet.mergeCells(`A${row}:C${row}`);
  sheet.getCell(`A${row}`).style = {
    font: { bold: true, size: 16, color: { argb: 'FFFFFF' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } }
  };
  sheet.getRow(row).height = 35;
}

function adicionarCabecalhoTabela(sheet: ExcelJS.Worksheet, row: number, headers: string[]) {
  sheet.addRow(headers);
  const headerRow = sheet.getRow(row);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });
  headerRow.height = 25;
}

function adicionarLinhaFilial(sheet: ExcelJS.Worksheet, row: number, branch: ResumoFilial, style: any) {
  sheet.addRow([branch.name, branch.totalAPagar, branch.totalAReceber]);
  
  const sheetRow = sheet.getRow(row);
  sheetRow.eachCell((cell, colNumber) => {
    cell.style = style;
    if (colNumber === 2 || colNumber === 3) {
      cell.numFmt = 'R$ #,##0.00';
    }
  });
}

function adicionarTotalGeral(sheet: ExcelJS.Worksheet, row: number, label: string, value: number) {
  sheet.addRow([label, value, '']);
  
  const totalRow = sheet.getRow(row);
  totalRow.eachCell((cell, colNumber) => {
    if (colNumber <= 2) {
      cell.style = totalRowStyle;
      if (colNumber === 2) {
        cell.numFmt = 'R$ #,##0.00';
      }
    }
  });
  
  // Mesclar células do label
  sheet.mergeCells(`A${row}:A${row}`);
}

function adicionarSecaoTotaisPorData(sheet: ExcelJS.Worksheet, startRow: number, dateSpecificTotals: any[]) {
  let currentRow = startRow;
  
  // Título da seção
  sheet.addRow(['TOTAIS POR DATA', '', '']);
  sheet.mergeCells(`A${currentRow}:C${currentRow}`);
  sheet.getCell(`A${currentRow}`).style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFF' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '1F4E79' } }
  };
  currentRow++;
  
  // Cabeçalho
  sheet.addRow(['Data', 'Total', '']);
  const headerRow = sheet.getRow(currentRow);
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber <= 2) {
      cell.style = headerStyle;
    }
  });
  currentRow++;
  
  // Dados por data
  for (const dateTotal of dateSpecificTotals) {
    sheet.addRow([dateTotal.date, dateTotal.total, '']);
    const dataRow = sheet.getRow(currentRow);
    dataRow.eachCell((cell, colNumber) => {
      if (colNumber <= 2) {
        cell.style = cellStyle;
        if (colNumber === 2) {
          cell.numFmt = 'R$ #,##0.00';
        }
      }
    });
    currentRow++;
  }
}

function formatarColunas(sheet: ExcelJS.Worksheet) {
  sheet.getColumn(1).width = 35; // Filial
  sheet.getColumn(2).width = 20; // Total A Pagar  
  sheet.getColumn(3).width = 20; // Total A Receber
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  try {
    console.log('=== INICIANDO GERAÇÃO EXCEL RESUMO ===');
    
    // Tentar obter dados do storage
    let summaryData = getSummaryData();
    
    // Se não há dados no storage, tentar carregar do cache
    if (!summaryData) {
      try {
        const cachePath = path.join(process.cwd(), 'temp', 'last_summary.json');
        if (fs.existsSync(cachePath)) {
          const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          summaryData = cached;
          console.log('Dados carregados do cache:', cachePath);
        }
      } catch (cacheError) {
        console.warn('Erro ao carregar cache:', cacheError);
      }
    }
    
    if (!summaryData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Nenhum dado para exportar. Faça o upload dos arquivos primeiro.' 
      });
    }

    console.log('Dados encontrados:', {
      branches: summaryData.branches.length,
      grandTotal: summaryData.grandTotal
    });

    // Gerar workbook Excel
    const workbook = await gerarExcelResumo(summaryData);
    
    // Configurar headers da resposta
    const fileName = `resumo_total_filiais_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Escrever workbook na resposta
    await workbook.xlsx.write(res);
    
    console.log('Excel de resumo gerado com sucesso!');
    res.end();
    
  } catch (error) {
    console.error('=== ERRO NA GERAÇÃO DO EXCEL RESUMO ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao gerar Excel: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }
}