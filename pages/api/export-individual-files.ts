import type { NextApiRequest, NextApiResponse } from 'next'
import * as ExcelJS from 'exceljs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { fileName } = req.body

    // Criar um novo workbook
    const workbook = new ExcelJS.Workbook()
    
    if (fileName === 'T014_VisaoGeralFluxoCaixaDetalhado_3') {
      // Arquivo T014_VisaoGeralFluxoCaixaDetalhado (3) - Recebimentos
      const worksheet = workbook.addWorksheet('Recebimentos - Arquivo 3')
      
      worksheet.columns = [
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Transacionador', key: 'transacionador', width: 40 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 }
      ]

      const recebimentos = [
        { vencimento: '01/09/2025', transacionador: 'ADRIANO ALFONSO HUNGER E OUTRO', documento: '6648/1', valor: 'R$ 1.430,00' },
        { vencimento: '01/09/2025', transacionador: 'ANDRE STABILE', documento: '7390/1', valor: 'R$ 11.600,00' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '8717/1', valor: 'R$ 11.992,00' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '8384/1', valor: 'R$ 61.084,25' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '8401/1', valor: 'R$ 36.725,50' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '8403/1', valor: 'R$ 24.733,50' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '6672/1', valor: 'R$ 6.060,87' },
        { vencimento: '01/09/2025', transacionador: 'ANTONIO MARCOS CARVALHO REZENDE', documento: '6672/1', valor: 'R$ 8.247,13' },
        { vencimento: '01/09/2025', transacionador: 'APLICACAO FINANCEIRA', documento: '9.903', valor: 'R$ 2.138.884,11' },
        { vencimento: '01/09/2025', transacionador: 'CAIO NOGUEIRA BATTISTETTI', documento: '6740/1', valor: 'R$ 9.744,40' },
        { vencimento: '01/09/2025', transacionador: 'CONQUISTA AGRONEGOCIOS COMERCIO E REPRESENTACAO LTDA', documento: '6950/1', valor: 'R$ 28.120,00' },
        { vencimento: '01/09/2025', transacionador: 'DALDI MICHEL TOMBINI', documento: '7733/1', valor: 'R$ 9.900,00' },
        { vencimento: '01/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '8526/1', valor: 'R$ 57.000,00' },
        { vencimento: '01/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '8528/1', valor: 'R$ 142,50' },
        { vencimento: '01/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '8495/1', valor: 'R$ 6.055,00' },
        { vencimento: '01/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '6924/1', valor: 'R$ 257.400,00' },
        { vencimento: '01/09/2025', transacionador: 'EBERSON OUTEIRO', documento: '7645/1', valor: 'R$ 21.850,00' },
        { vencimento: '01/09/2025', transacionador: 'EDER SOUZA SILVA CARVALHO', documento: '7996/1', valor: 'R$ 7.484,00' },
        { vencimento: '01/09/2025', transacionador: 'EDIO NAVARINI', documento: '7883/1', valor: 'R$ 17.000,00' },
        { vencimento: '01/09/2025', transacionador: 'ELISANDRO CADORE', documento: 'PED7703/1', valor: 'R$ 42.900,00' },
        { vencimento: '01/09/2025', transacionador: 'GILBERTO BONINI', documento: '7468/1', valor: 'R$ 81.642,00' },
        { vencimento: '01/09/2025', transacionador: 'HELIO ROSA CABRAL JUNIOR', documento: '8837/1', valor: 'R$ 34.712,50' },
        { vencimento: '01/09/2025', transacionador: 'HELIO ROSA CABRAL JUNIOR', documento: '8759/1', valor: 'R$ 13.850,00' },
        { vencimento: '01/09/2025', transacionador: 'JOAO TEIXEIRA RODRIGUES NETO', documento: '8688/1', valor: 'R$ 6.700,00' },
        { vencimento: '01/09/2025', transacionador: 'JOAO TEIXEIRA RODRIGUES NETO', documento: '8512/1', valor: 'R$ 26.800,00' },
        { vencimento: '01/09/2025', transacionador: 'JOSE CARLOS BONGIOVANI', documento: '7313/1', valor: 'R$ 7.052,50' },
        { vencimento: '01/09/2025', transacionador: 'JOSE RENATO DE FREITAS ALMEIDA II', documento: '6721/1', valor: 'R$ 88.200,00' },
        { vencimento: '01/09/2025', transacionador: 'LAURINDO AIMI', documento: '8224/1', valor: 'R$ 37.024,25' },
        { vencimento: '01/09/2025', transacionador: 'LEONARDO MEDEIROS TELES', documento: '6966/1', valor: 'R$ 7.490,00' },
        { vencimento: '01/09/2025', transacionador: 'LEONARDO MEDEIROS TELES', documento: '6994/1', valor: 'R$ 78.400,00' },
        { vencimento: '01/09/2025', transacionador: 'LUCAS MEDEIROS TELES E OUTROS', documento: '6723/1', valor: 'R$ 64.200,00' },
        { vencimento: '01/09/2025', transacionador: 'MARCELO JONY SWART', documento: '8008/1', valor: 'R$ 132.000,00' },
        { vencimento: '01/09/2025', transacionador: 'MARCELO JONY SWART', documento: '7916/1', valor: 'R$ 70.400,00' },
        { vencimento: '01/09/2025', transacionador: 'MARCELO JONY SWART', documento: '7917/1', valor: 'R$ 165.000,00' },
        { vencimento: '01/09/2025', transacionador: 'MARCELO JONY SWART', documento: '7801/1', valor: 'R$ 110.000,00' },
        { vencimento: '01/09/2025', transacionador: 'MARCELO JONY SWART', documento: '7604/1', valor: 'R$ 369.600,00' },
        { vencimento: '01/09/2025', transacionador: 'ONALDO ANTONIO GOMES', documento: '7303/1', valor: 'R$ 135.000,00' },
        { vencimento: '01/09/2025', transacionador: 'PRIORI SEMENTES E DEFENSIVOS AGRICOLAS LTDA', documento: '8770/1', valor: 'R$ 65.100,00' },
        { vencimento: '01/09/2025', transacionador: 'PRIORI SEMENTES E DEFENSIVOS AGRICOLAS LTDA', documento: '8380/1', valor: 'R$ 43.500,00' },
        { vencimento: '01/09/2025', transacionador: 'PRIORI SEMENTES E DEFENSIVOS AGRICOLAS LTDA', documento: '8381/1', valor: 'R$ 107.100,00' }
      ]

      worksheet.addRows(recebimentos)
      
      // Adicionar totais
      worksheet.addRow(['', '', '', ''])
      const totalRecebimentosRow = worksheet.addRow(['', '', 'TOTAL A RECEBER:', 'R$ 5.613.986,54'])
      const totalPagarRow = worksheet.addRow(['', '', 'TOTAL A PAGAR:', 'R$ 0,00'])
      
      totalRecebimentosRow.font = { bold: true }
      totalPagarRow.font = { bold: true }

    } else if (fileName === 'T014_VisaoGeralFluxoCaixaDetalhado_4') {
      // Arquivo T014_VisaoGeralFluxoCaixaDetalhado (4) - Pagamentos
      const worksheet = workbook.addWorksheet('Pagamentos - Arquivo 4')
      
      worksheet.columns = [
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Transacionador', key: 'transacionador', width: 40 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 }
      ]

      const pagamentos = [
        { vencimento: '06/09/2025', transacionador: 'JERONIMO ANICETO REZENDE', documento: '8886', valor: 'R$ 9.000,00' },
        { vencimento: '07/09/2025', transacionador: 'JOAO FRANCISCO SILVEIRA GOULART', documento: '7314', valor: 'R$ 211.200,00' },
        { vencimento: '08/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '5990', valor: 'R$ 24.830,00' },
        { vencimento: '08/09/2025', transacionador: 'HELIO ROSA CABRAL JUNIOR', documento: '7482', valor: 'R$ 22.248,85' },
        { vencimento: '09/09/2025', transacionador: 'HELENA DE ASSIS CARVALHO', documento: '6670', valor: 'R$ 6.600,00' },
        { vencimento: '10/09/2025', transacionador: 'BANCO DO BRASIL S A JATAI - GO', documento: '8.652', valor: 'R$ 10.140,00' },
        { vencimento: '10/09/2025', transacionador: 'KEPLER WEBER INDL S/A', documento: '201986', valor: 'R$ 35.000,00' },
        { vencimento: '10/09/2025', transacionador: 'QS CONTROLADORIA E ASSESSORIA CONTABIL', documento: '3942', valor: 'R$ 9.108,00' },
        { vencimento: '12/09/2025', transacionador: 'JORGE GUILHERME GROSS - FAZENDA VARGEM BONITA III', documento: '1.646700', valor: 'R$ 1.646.700,00' },
        { vencimento: '12/09/2025', transacionador: 'DUQUIMA AGRONEGOCIOS LTDA', documento: '7398', valor: 'R$ 50.250,00' }
      ]

      worksheet.addRows(pagamentos)
      
      // Adicionar totais
      worksheet.addRow(['', '', '', ''])
      const totalRecebimentosRow = worksheet.addRow(['', '', 'TOTAL A RECEBER:', 'R$ 324.128,85'])
      const totalPagarRow = worksheet.addRow(['', '', 'TOTAL A PAGAR:', 'R$ 1.700.948,00'])
      
      totalRecebimentosRow.font = { bold: true }
      totalPagarRow.font = { bold: true }

    } else if (fileName === 'T014_VisaoGeralFluxoCaixaDetalhado_1') {
      // Arquivo T014_VisaoGeralFluxoCaixaDetalhado (1) - Pagamentos diversos
      const worksheet = workbook.addWorksheet('Pagamentos - Arquivo 1')
      
      worksheet.columns = [
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Transacionador', key: 'transacionador', width: 40 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 }
      ]

      const pagamentos = [
        { vencimento: '01/09/2025', transacionador: 'GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA', documento: '27920', valor: 'R$ 10.166,67' },
        { vencimento: '01/09/2025', transacionador: 'TALES AUGUSTO MACHADO', documento: '40.000', valor: 'R$ 8.000,00' },
        { vencimento: '02/09/2025', transacionador: 'BRASMIX ENGENHARIA DE CONCRETO LTDA', documento: '5553', valor: 'R$ 42.700,00' },
        { vencimento: '02/09/2025', transacionador: 'JOAO PEDRO JOSAFA FABRIS SANCHES', documento: '2909', valor: 'R$ 500,00' },
        { vencimento: '03/09/2025', transacionador: 'GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA', documento: '28967', valor: 'R$ 2.000,00' },
        { vencimento: '03/09/2025', transacionador: 'GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA', documento: '28971', valor: 'R$ 159,00' },
        { vencimento: '03/09/2025', transacionador: 'GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA', documento: '29047', valor: 'R$ 138,00' },
        { vencimento: '03/09/2025', transacionador: 'GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA', documento: '29126', valor: 'R$ 4.070,00' },
        { vencimento: '05/09/2025', transacionador: 'BRASMIX ENGENHARIA DE CONCRETO LTDA', documento: '5552', valor: 'R$ 41.480,00' },
        { vencimento: '05/09/2025', transacionador: 'BRASMIX ENGENHARIA DE CONCRETO LTDA', documento: '5551', valor: 'R$ 1.590,00' },
        { vencimento: '05/09/2025', transacionador: 'EQUATORIAL ENERGIA', documento: '2907', valor: 'R$ 12.959,57' },
        { vencimento: '05/09/2025', transacionador: 'LTF AGROPECUARIA LTDA EPP', documento: '2908', valor: 'R$ 6.000,00' }
      ]

      worksheet.addRows(pagamentos)
      
      // Adicionar totais
      worksheet.addRow(['', '', '', ''])
      const totalRecebimentosRow = worksheet.addRow(['', '', 'TOTAL A RECEBER:', 'R$ 0,00'])
      const totalPagarRow = worksheet.addRow(['', '', 'TOTAL A PAGAR:', 'R$ 129.763,24'])
      
      totalRecebimentosRow.font = { bold: true }
      totalPagarRow.font = { bold: true }
    }

    // Estilizar cabeçalho para todos os arquivos
    const worksheet = workbook.worksheets[0]
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
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

    // Configurar resposta HTTP
    const fileNameSuffix = fileName || 'individual'
    const excelFileName = `relatorio_${fileNameSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`)

    // Escrever o arquivo para o response
    await workbook.xlsx.write(res)
    res.end()

  } catch (error) {
    console.error('Error in export-individual-files:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    })
  }
}