import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Iniciando geração do Excel...')
    console.log('Method:', req.method)
    console.log('Body:', req.body)
    
    // Criar um novo workbook
    const workbook = new ExcelJS.Workbook()
    
    // Teste simples primeiro
    const worksheet = workbook.addWorksheet('Teste')
    worksheet.columns = [
      { header: 'Coluna 1', key: 'col1', width: 20 },
      { header: 'Coluna 2', key: 'col2', width: 20 }
    ]
    
    worksheet.addRows([
      { col1: 'Dados 1', col2: 'Valor 1' },
      { col1: 'Dados 2', col2: 'Valor 2' }
    ])

    console.log('Workbook criado com sucesso')

    // Configurar resposta HTTP
    const fileName = `teste_excel_${new Date().toISOString().split('T')[0]}.xlsx`
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    console.log('Headers configurados')

    // Escrever o arquivo para o response
    await workbook.xlsx.write(res)
    console.log('Arquivo escrito com sucesso')
    
    if (!res.headersSent) {
      res.end()
    }
    console.log('Response finalizado')
    
  } catch (error) {
    console.error('Error in export-excel-simple:', error)
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      })
    }
  }
}