import { NextApiRequest, NextApiResponse } from 'next';
import ExcelJS from 'exceljs';
import { storage } from '../../lib/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('[EXPORT] Iniciando exportação Excel');
    console.log('[EXPORT] Storage keys:', storage.keys());
    console.log('[EXPORT] Storage summaryData exists:', !!storage.get('summaryData'));
    
    const summaryData = storage.get('summaryData');
    
    if (!summaryData) {
      console.log('[EXPORT] Nenhum dados encontrado no storage');
      return res.status(400).json({ 
        error: 'Nenhum dado de resumo encontrado. Faça upload dos arquivos CSV primeiro.',
        debug: {
          storageKeys: storage.keys(),
          hasData: !!summaryData
        }
      });
    }

    console.log('[EXPORT] SummaryData encontrado:', {
      branches: summaryData.branches?.length || 0,
      dateSpecificTotals: summaryData.dateSpecificTotals?.length || 0,
      grandTotal: summaryData.grandTotal
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumo Total das Filiais');    // ESTILOS PADRONIZADOS OBRIGATÓRIOS
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      border: {
        top: { style: 'thin' as const }, left: { style: 'thin' as const },
        bottom: { style: 'thin' as const }, right: { style: 'thin' as const }
      }
    };

    const cellStyle = {
      border: {
        top: { style: 'thin' as const }, left: { style: 'thin' as const },
        bottom: { style: 'thin' as const }, right: { style: 'thin' as const }
      },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F8F9FA' } }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FFFFFF' } },
      alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } }
    };

    let currentRow = 1;

    // SEÇÃO 1: TÍTULO
    sheet.addRow(['RESUMO TOTAL DAS FILIAIS', '']);
    sheet.mergeCells(`A${currentRow}:B${currentRow}`);
    sheet.getCell(`A${currentRow}`).style = titleStyle;
    sheet.getRow(currentRow).height = 35;
    currentRow += 1; // Pular apenas 1 linha

    // SEÇÃO 2: DADOS DAS FILIAIS
    sheet.addRow(['Filial', 'Total A Pagar']);
    sheet.getRow(currentRow).eachCell((cell, colNumber) => {
      if (colNumber <= 2) cell.style = headerStyle;
    });
    currentRow++;

    // Dados das filiais
    for (const branch of summaryData.branches || []) {
      sheet.addRow([branch.name, branch.totalAPagar || 0]);
      const row = sheet.getRow(currentRow);
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.style = cellStyle;
          if (colNumber === 2) cell.numFmt = 'R$ #,##0.00';
        }
      });
      currentRow++;
    }

    // Linha de subtotal das filiais
    if (summaryData.branches && summaryData.branches.length > 0) {
      const subtotalRow = sheet.addRow([
        'TOTAL FILIAIS',
        summaryData.grandTotalAPagar || 0
      ]);
      subtotalRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.style = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2F5597' } },
            border: {
              top: { style: 'thin' }, left: { style: 'thin' },
              bottom: { style: 'thin' }, right: { style: 'thin' }
            },
            alignment: { horizontal: 'center', vertical: 'middle' }
          } as any;
          if (colNumber === 2) cell.numFmt = 'R$ #,##0.00';
        }
      });
      subtotalRow.height = 22;
      currentRow = subtotalRow.number + 1; // Próxima linha após subtotal
      // Adiciona UMA linha em branco de espaçamento
      const blankAfterSubtotal = sheet.addRow(['', '']);
      currentRow = blankAfterSubtotal.number + 1;
    }

    // SEÇÃO 3: TOTAIS POR DATA (SE DISPONÍVEL)
    if (summaryData.dateSpecificTotals && summaryData.dateSpecificTotals.length > 0) {
      console.log('[EXPORT] Adicionando seção TOTAL POR DIA DA SEMANA');
      // Cria diretamente a linha de cabeçalho (sem deslocamento incorreto)
      const headerRow = sheet.addRow(['TOTAL POR DIA DA SEMANA', 'Total']);
      headerRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) cell.style = headerStyle;
      });
      headerRow.height = 25;
      currentRow = headerRow.number + 1;

      // Ordenar datas cronologicamente
      const sortedDateTotals = [...summaryData.dateSpecificTotals].sort((a, b) => {
        const parseDate = (dateStr: string) => {
          const parts = dateStr.split('/');
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        };
        return parseDate(a.day).getTime() - parseDate(b.day).getTime();
      });

      let consolidatedGrandTotal = 0;

      // Adicionar dados das datas com dia da semana
      for (const dateData of sortedDateTotals) {
        const parts = dateData.day.split('/');
        let dayOfWeek = '';
        if (parts.length === 3) {
          const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          dayOfWeek = dayNames[date.getDay()];
        }
        
        const dateWithDay = dayOfWeek ? `${dateData.day} (${dayOfWeek})` : dateData.day;
        
        const dataRow = sheet.addRow([dateWithDay, dateData.total]);
        dataRow.eachCell((cell, colNumber) => {
          if (colNumber <= 2) {
            cell.style = cellStyle;
            if (colNumber === 2) cell.numFmt = 'R$ #,##0.00';
          }
        });
        consolidatedGrandTotal += dateData.total;
        currentRow = dataRow.number + 1;
      }

      // TOTAL GERAL FINAL
      const consolidatedTotalRow = sheet.addRow(['TOTAL GERAL (Datas)', consolidatedGrandTotal]);
      consolidatedTotalRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.style = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '2F5597' } },
            border: {
              top: { style: 'thin' as const }, left: { style: 'thin' as const },
              bottom: { style: 'thin' as const }, right: { style: 'thin' as const }
            },
            alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
          };
          if (colNumber === 2) cell.numFmt = 'R$ #,##0.00';
        }
      });
    }

    // CONFIGURAÇÃO DE LARGURAS DAS COLUNAS
    sheet.getColumn(1).width = 35; // Filial
    sheet.getColumn(2).width = 22; // Total A Pagar

    // HEADERS DE RESPOSTA PARA DOWNLOAD
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="resumo_total_filiais_${new Date().toISOString().split('T')[0]}.xlsx"`);

    // ESCRITA E ENVIO DO ARQUIVO
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erro na exportação do resumo Excel:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}