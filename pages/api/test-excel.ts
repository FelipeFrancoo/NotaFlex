import type { NextApiRequest, NextApiResponse } from 'next'
import * as ExcelJS from 'exceljs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Criar um workbook simples para teste
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Teste')

    // Adicionar dados simples
    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 20 },
      { header: 'Valor', key: 'valor', width: 15 }
    ]

    worksheet.addRows([
      { nome: 'Teste 1', valor: 'R$ 100,00' },
      { nome: 'Teste 2', valor: 'R$ 200,00' }
    ])

    // Configurar resposta
    const fileName = `teste_${new Date().toISOString().split('T')[0]}.xlsx`
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    // Escrever arquivo
    await workbook.xlsx.write(res)
    res.end()
    
  } catch (error) {
    console.error('Error in test-excel:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro no teste: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
    })
  }
}