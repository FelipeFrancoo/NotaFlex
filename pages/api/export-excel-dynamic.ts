import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

// Interface para dados processados
interface TransactionData {
  vencimento: string
  transacionador: string
  documento: string
  valor: string
  valorNumerico: number
}

interface FilialData {
  nome: string
  contasAPagar: TransactionData[]
  contasAReceber: TransactionData[]
  totalAPagar: number
  totalAReceber: number
  totaisPorDia: { [data: string]: number }
}

// Função para processar CSV
function processCSV(csvContent: string, nomeArquivo: string): FilialData {
  const lines = csvContent.split('\n')
  const transacoes: TransactionData[] = []
  let totalAPagar = 0
  let totalAReceber = 0
  const totaisPorDia: { [data: string]: number } = {}
  
  // Extrair nome da filial do arquivo
  const nomeFilial = nomeArquivo.replace('.csv', '').toUpperCase()
  
  let isDataSection = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Pular linhas vazias ou cabeçalhos
    if (!line || line.includes('PERÍODO') || line.includes(';;;')) continue
    
    // Detectar início dos dados
    if (line.includes('Vencimento;Transacionador;Documento;Valor')) {
      isDataSection = true
      continue
    }
    
    if (isDataSection && line.includes(';')) {
      const columns = line.split(';')
      
      // Pular linhas de total
      if (columns[0].includes('TOTAL') || columns[1].includes('TOTAL')) continue
      
      if (columns.length >= 4 && columns[0] && columns[1] && columns[3]) {
        const vencimento = columns[0].trim()
        const transacionador = columns[1].trim()
        const documento = columns[2].trim()
        const valorTexto = columns[3].trim()
        
        // Extrair valor numérico
        const valorNumerico = parseFloat(
          valorTexto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
        ) || 0
        
        if (vencimento && transacionador && valorNumerico > 0) {
          const transacao: TransactionData = {
            vencimento,
            transacionador,
            documento,
            valor: valorTexto,
            valorNumerico
          }
          
          transacoes.push(transacao)
          totalAPagar += valorNumerico
          
          // Agrupar por dia
          if (!totaisPorDia[vencimento]) {
            totaisPorDia[vencimento] = 0
          }
          totaisPorDia[vencimento] += valorNumerico
        }
      }
    }
  }
  
  return {
    nome: nomeFilial,
    contasAPagar: transacoes,
    contasAReceber: [], // Por enquanto vazio, pode ser implementado se necessário
    totalAPagar,
    totalAReceber,
    totaisPorDia
  }
}

export const config = {
  api: {
    bodyParser: false, // Necessário para processar uploads
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Iniciando geração do Excel...')
  console.log('Method:', req.method)
  console.log('Body:', req.body)

  try {
    // Se não for POST, usar dados hardcoded (para manter compatibilidade)
    if (req.method !== 'POST') {
      return generateHardcodedExcel(res)
    }

    // Parse do form data (arquivos)
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'temp'),
      keepExtensions: true,
    })

    const [fields, files] = await form.parse(req)
    
    // Processar arquivos CSV
    const filiaisData: FilialData[] = []
    
    if (files.csvFiles) {
      const csvFiles = Array.isArray(files.csvFiles) ? files.csvFiles : [files.csvFiles]
      
      for (const file of csvFiles) {
        if (file.filepath) {
          const csvContent = fs.readFileSync(file.filepath, 'utf-8')
          const nomeArquivo = file.originalFilename || 'arquivo.csv'
          const filialData = processCSV(csvContent, nomeArquivo)
          filiaisData.push(filialData)
          
          // Limpar arquivo temporário
          fs.unlinkSync(file.filepath)
        }
      }
    }

    // Se não há arquivos, usar dados hardcoded
    if (filiaisData.length === 0) {
      console.log('Nenhum arquivo CSV encontrado, usando dados hardcoded')
      return generateHardcodedExcel(res)
    }

    // Gerar Excel dinâmico
    return generateDynamicExcel(filiaisData, res)

  } catch (error) {
    console.error('Error in export-excel:', error)
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      })
    }
  }
}

// Função para gerar Excel dinâmico
async function generateDynamicExcel(filiaisData: FilialData[], res: NextApiResponse) {
  const workbook = new ExcelJS.Workbook()
  
  // ABA 1: Resumo Geral
  const resumoWorksheet = workbook.addWorksheet('Resumo Geral')
  
  // Adicionar cabeçalho da filial
  const tituloRow = resumoWorksheet.addRow(['RELATÓRIO GERAL - TODAS AS FILIAIS'])
  resumoWorksheet.mergeCells('A1:D1')
  tituloRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  tituloRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
  tituloRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  tituloRow.height = 25
  
  resumoWorksheet.addRow([]) // Linha vazia
  
  resumoWorksheet.columns = [
    { header: 'Filial', key: 'filial', width: 20 },
    { header: 'Total A Pagar', key: 'totalAPagar', width: 18 },
    { header: 'Total A Receber', key: 'totalAReceber', width: 18 },
    { header: 'Saldo Líquido', key: 'saldoLiquido', width: 18 }
  ]

  // Adicionar dados das filiais
  let totalGeralAPagar = 0
  let totalGeralAReceber = 0
  
  filiaisData.forEach(filial => {
    totalGeralAPagar += filial.totalAPagar
    totalGeralAReceber += filial.totalAReceber
    
    resumoWorksheet.addRow({
      filial: filial.nome,
      totalAPagar: `R$ ${filial.totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      totalAReceber: `R$ ${filial.totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      saldoLiquido: `R$ ${(filial.totalAReceber - filial.totalAPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    })
  })
  
  // Total geral
  const totalGeralRow = resumoWorksheet.addRow({
    filial: 'TOTAL GERAL',
    totalAPagar: `R$ ${totalGeralAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    totalAReceber: `R$ ${totalGeralAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    saldoLiquido: `R$ ${(totalGeralAReceber - totalGeralAPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  })

  // Estilizar cabeçalho
  const headerRow = resumoWorksheet.getRow(3)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  
  totalGeralRow.font = { bold: true }
  totalGeralRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }

  // CRIAR ABAS PARA CADA FILIAL
  filiaisData.forEach(filial => {
    const worksheet = workbook.addWorksheet(filial.nome)
    
    // Cabeçalho da filial
    const tituloFilialRow = worksheet.addRow([`RELATÓRIO - ${filial.nome}`])
    worksheet.mergeCells('A1:D1')
    tituloFilialRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    tituloFilialRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
    tituloFilialRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    tituloFilialRow.height = 25
    
    worksheet.addRow([]) // Linha vazia
    
    worksheet.columns = [
      { header: 'Vencimento', key: 'vencimento', width: 12 },
      { header: 'Transacionador', key: 'transacionador', width: 40 },
      { header: 'Documento', key: 'documento', width: 15 },
      { header: 'Valor', key: 'valor', width: 15 }
    ]

    // Seção A PAGAR
    worksheet.addRow(['=== CONTAS A PAGAR ===', '', '', ''])
    
    // Agrupar por data
    const transacoesPorData: { [data: string]: TransactionData[] } = {}
    
    filial.contasAPagar.forEach(transacao => {
      if (!transacoesPorData[transacao.vencimento]) {
        transacoesPorData[transacao.vencimento] = []
      }
      transacoesPorData[transacao.vencimento].push(transacao)
    })
    
    // Adicionar dados agrupados por data
    Object.keys(transacoesPorData).sort().forEach(data => {
      worksheet.addRow(['', `=== ${data} ===`, '', ''])
      
      const transacoesDaData = transacoesPorData[data]
      transacoesDaData.forEach(transacao => {
        worksheet.addRow([
          transacao.vencimento,
          transacao.transacionador,
          transacao.documento,
          transacao.valor
        ])
      })
      
      // Total do dia
      const totalDia = filial.totaisPorDia[data] || 0
      const totalDiaRow = worksheet.addRow(['', '', 'TOTAL:', `R$ ${totalDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`])
      totalDiaRow.font = { bold: true }
      totalDiaRow.getCell(3).alignment = { horizontal: 'center' }
      totalDiaRow.getCell(4).alignment = { horizontal: 'center' }
      
      worksheet.addRow(['', '', '', '']) // Linha vazia
    })
    
    // Total geral da filial
    const totalGeralFilialRow = worksheet.addRow(['', '', 'TOTAL GERAL A PAGAR:', `R$ ${filial.totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`])
    totalGeralFilialRow.font = { bold: true }
    totalGeralFilialRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
    totalGeralFilialRow.getCell(3).alignment = { horizontal: 'center' }
    totalGeralFilialRow.getCell(4).alignment = { horizontal: 'center' }

    // Contas a receber (se houver)
    worksheet.addRow(['', '', '', ''])
    worksheet.addRow(['=== CONTAS A RECEBER ===', '', '', ''])
    
    if (filial.contasAReceber.length === 0) {
      const semReceberRow = worksheet.addRow(['', 'NENHUMA CONTA A RECEBER NESTE PERÍODO', '', 'R$ 0,00'])
      semReceberRow.font = { italic: true }
    }
  })

  // Aplicar formatação em todas as abas
  workbook.worksheets.forEach(worksheet => {
    // Estilizar cabeçalho da tabela (linha 3)
    if (worksheet.rowCount >= 3) {
      const headerRow = worksheet.getRow(3)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    }

    // Aplicar bordas
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })

    // Alinhar valores à direita (verificar se a coluna existe)
    try {
      const valorColumn = worksheet.getColumn('valor')
      if (valorColumn && valorColumn.number) {
        valorColumn.alignment = { horizontal: 'right' }
      }
    } catch (columnError) {
      // Coluna 'valor' não existe nesta aba, ignorar
      console.log('Coluna "valor" não encontrada na aba:', worksheet.name)
    }
  })

  // Configurar resposta HTTP
  const fileName = `relatorio_dinamico_${new Date().toISOString().split('T')[0]}.xlsx`
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

  // Escrever o arquivo para o response
  await workbook.xlsx.write(res)
  if (!res.headersSent) {
    res.end()
  }
}

// Função para manter compatibilidade com dados hardcoded (fallback)
async function generateHardcodedExcel(res: NextApiResponse) {
  const workbook = new ExcelJS.Workbook()
  
  // ABA 1: Resumo Geral
  const resumoWorksheet = workbook.addWorksheet('Resumo Geral')
  
  // Cabeçalho principal
  const tituloRow = resumoWorksheet.addRow(['RELATÓRIO GERAL - TODAS AS FILIAIS'])
  resumoWorksheet.mergeCells('A1:D1')
  tituloRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  tituloRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
  tituloRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  tituloRow.height = 25
  
  resumoWorksheet.addRow([]) // Linha vazia
  
  resumoWorksheet.columns = [
    { header: 'Filial', key: 'filial', width: 20 },
    { header: 'Total A Pagar', key: 'totalAPagar', width: 18 },
    { header: 'Total A Receber', key: 'totalAReceber', width: 18 },
    { header: 'Saldo Líquido', key: 'saldoLiquido', width: 18 }
  ]

  // Dados hardcoded para demonstração
  const resumoData = [
    { filial: 'GO SEEDS', totalAPagar: 'R$ 1.912.040,00', totalAReceber: 'R$ 3.175.990,36', saldoLiquido: 'R$ 1.263.950,36' },
    { filial: 'BEIJA FLOR', totalAPagar: 'R$ 129.763,24', totalAReceber: 'R$ 0,00', saldoLiquido: '-R$ 129.763,24' },
    { filial: 'SAGUIA', totalAPagar: 'R$ 138.251,10', totalAReceber: 'R$ 0,00', saldoLiquido: '-R$ 138.251,10' },
    { filial: 'ULTRA SEEDS', totalAPagar: 'R$ 80,96', totalAReceber: 'R$ 0,00', saldoLiquido: '-R$ 80,96' }
  ]

  resumoData.forEach(row => {
    resumoWorksheet.addRow(row)
  })

  const totalGeralRow = resumoWorksheet.addRow({
    filial: 'TOTAL GERAL',
    totalAPagar: 'R$ 2.180.135,30',
    totalAReceber: 'R$ 3.175.990,36',
    saldoLiquido: 'R$ 995.855,06'
  })
  
  // Estilizar cabeçalho
  const headerRow = resumoWorksheet.getRow(3)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  
  totalGeralRow.font = { bold: true }
  totalGeralRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }

  // Aplicar formatação em todas as abas
  workbook.worksheets.forEach(worksheet => {
    // Aplicar bordas
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })
  })

  // Configurar resposta HTTP
  const fileName = `relatorio_hardcoded_${new Date().toISOString().split('T')[0]}.xlsx`
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

  // Escrever o arquivo para o response
  await workbook.xlsx.write(res)
  if (!res.headersSent) {
    res.end()
  }
}