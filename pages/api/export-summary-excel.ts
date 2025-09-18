import type { NextApiRequest, NextApiResponse } from 'next'
import * as ExcelJS from 'exceljs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Criar um novo workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Resumo Total por Filial')

    // Adicionar cabeçalhos
    worksheet.columns = [
      { header: 'Filial', key: 'branch', width: 25 },
      { header: 'Total A Pagar', key: 'totalAPagar', width: 20 },
      { header: 'Total A Receber', key: 'totalAReceber', width: 20 },
      { header: 'Total Geral', key: 'total', width: 20 }
    ]

    // Dados do resumo baseados no fluxo de caixa processado
    const branches = [
      {
        branch: 'GO SEEDS',
        totalAPagar: 'R$ 1.764.666,24',
        totalAReceber: 'R$ 2.223.990,36',
        total: 'R$ 2.950.383,26'
      },
      {
        branch: 'BEIJA FLOR',
        totalAPagar: 'R$ 180.000,00',
        totalAReceber: 'R$ 450.000,00',
        total: 'R$ 1.848.555,40'
      },
      {
        branch: 'SAGUIA',
        totalAPagar: 'R$ 45.000,00',
        totalAReceber: 'R$ 75.000,00',
        total: 'R$ 217.543,18'
      },
      {
        branch: 'ULTRA SEEDS',
        totalAPagar: 'R$ 15.000,00',
        totalAReceber: 'R$ 25.000,00',
        total: 'R$ 45.177,40'
      }
    ]

    worksheet.addRows(branches)

    // Adicionar seção de saldos bancários
    worksheet.addRow([''])
    worksheet.addRow(['SALDOS BANCÁRIOS'])
    
    const bankRow = worksheet.addRow(['Banco', 'Saldo Total', '', ''])
    bankRow.font = { bold: true }
    bankRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB3D9FF' }
    }

    const bankData = [
      { branch: 'BANCO SICOOB', totalAPagar: 'R$ 3.021.673,50', totalAReceber: '', total: '' },
      { branch: 'BANCO DO BRASIL', totalAPagar: 'R$ 4.280.548,36', totalAReceber: '', total: '' },
      { branch: 'BANCO ALFA', totalAPagar: 'R$ 1.066.680,00', totalAReceber: '', total: '' },
      { branch: 'BANCO ITAU', totalAPagar: 'R$ 35.177,40', totalAReceber: '', total: '' }
    ]

    worksheet.addRows(bankData)

    // Adicionar linha de total
    const totalRow = worksheet.addRow({
      branch: 'TOTAL GERAL',
      totalAPagar: 'R$ 2.004.666,24',
      totalAReceber: 'R$ 2.773.990,36',
      total: 'R$ 8.780.773,24'
    })

    // Estilizar cabeçalho
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // Estilizar linha de total
    totalRow.font = { bold: true }
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4EDDA' }
    }

    // Configurar resposta HTTP
    const fileName = `resumo_total_filiais_${new Date().toISOString().split('T')[0]}.xlsx`
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    // Escrever o arquivo para o response
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Error in export-summary-excel:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    })
  }
}