import * as Papa from 'papaparse';
import * as fs from 'fs';

// ESTRUTURA DE DADOS PARA RESUMO TOTAL
export interface ResumoFilial {
  name: string;           // Nome da filial extraído do arquivo
  totalAPagar: number;    // Total de Contas a Pagar
  totalAReceber: number;  // Total de Contas a Receber
  total: number;          // Soma dos dois totais
}

export interface DateTotal {
  date: string;
  total: number;
}

export interface DadosResumo {
  branches: ResumoFilial[];                    // Array com dados de cada filial
  dateSpecificTotals: DateTotal[];            // Totais consolidados por data
  grandTotal: number;                         // Total geral de todas as filiais
  grandTotalAPagar: number;                   // Total geral A Pagar
  grandTotalAReceber: number;                 // Total geral A Receber
}

// PADRÕES EXATOS PARA IDENTIFICAÇÃO DE TOTAIS A PAGAR
const PADROES_A_PAGAR = [
  'TOTAL CONTAS A PAGAR',
  'TOTALCONTASAPAGAR',
  'TOTAL A PAGAR', 
  'TOTALPAGAR',
  'TOTAL GERAL A PAGAR',
  /TOTAL.*A.*PAGAR/,
  /TOTAL.*PAGAR(?!.*RECEBER)/
];

// PADRÕES EXATOS PARA IDENTIFICAÇÃO DE TOTAIS A RECEBER
const PADROES_A_RECEBER = [
  'TOTAL CONTAS A RECEBER',
  'TOTALCONTASARECEBER', 
  'TOTAL A RECEBER',
  'TOTALRECEBER',
  'TOTAL GERAL A RECEBER',
  /TOTAL.*A.*RECEBER/,
  /TOTAL.*RECEBER(?!.*PAGAR)/
];

// FUNÇÃO DE DECODIFICAÇÃO DE ARQUIVO COM MÚLTIPLAS TENTATIVAS
function decodificarArquivo(file: Express.Multer.File): string {
  const buffer = fs.readFileSync(file.path);
  const encodings = ['utf-8', 'latin1', 'ascii', 'utf16le'];
  
  for (const encoding of encodings) {
    try {
      const content = buffer.toString(encoding as BufferEncoding);
      // Verificar se a decodificação foi bem-sucedida (não há caracteres estranhos)
      if (content && !content.includes('�') && content.length > 10) {
        return content;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Fallback para utf-8
  return buffer.toString('utf-8');
}

// FUNÇÃO DE EXTRAÇÃO DE NOME DA FILIAL
function extrairNomeFilial(rows: any[][], filename: string): string {
  // Estratégia 1: Buscar nas primeiras 10 linhas por padrões
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const rowText = row.join(' ').toUpperCase();
    
    // Padrões de identificação de filial
    const patterns = [
      /FILIAL\s*[:;-]\s*([A-Za-z0-9 _\-ÇÁÉÍÓÚÃÕÂÊÔàáéíóúçãõâêô]+)/i,
      /EMPRESA\s*[:;-]\s*([A-Za-z0-9 _\-ÇÁÉÍÓÚÃÕÂÊÔàáéíóúçãõâêô]+)/i,
      /^FILIAL[;,:]\s*([^;,:]+)/i,
      /^EMPRESA[;,:]\s*([^;,:]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = rowText.match(pattern);
      if (match && match[1]) {
        return match[1].trim().toUpperCase();
      }
    }
    
    // Verificar se a primeira célula contém nome da filial
    const firstCell = row[0]?.toString().trim();
    if (firstCell && firstCell.length > 3 && firstCell.length < 50) {
      const upperCell = firstCell.toUpperCase();
      if (upperCell.includes('FILIAL') || upperCell.includes('EMPRESA')) {
        return upperCell;
      }
    }
  }
  
  // Estratégia 2: Extrair do nome do arquivo
  let cleanName = filename.replace(/\.(csv|CSV)$/, '');
  cleanName = cleanName.replace(/^T\d+[_-]*/, ''); // Remover prefixos técnicos
  cleanName = cleanName.replace(/VISAOGERALFLUXOCAIXADETALHADO/gi, '');
  cleanName = cleanName.replace(/\(\d+\)$/g, ''); // Remover (1), (2)
  cleanName = cleanName.replace(/[_-]+/g, ' ').trim().toUpperCase();
  
  return cleanName || 'FILIAL_DESCONHECIDA';
}

// FUNÇÃO DE IDENTIFICAÇÃO DE LINHAS TOTAL A PAGAR
function isAPagarTotalRow(rowText: string): boolean {
  return PADROES_A_PAGAR.some(pattern => 
    typeof pattern === 'string' 
      ? rowText.includes(pattern)
      : pattern.test(rowText)
  ) && !rowText.includes('RECEBER');
}

// FUNÇÃO DE IDENTIFICAÇÃO DE LINHAS TOTAL A RECEBER  
function isAReceberTotalRow(rowText: string): boolean {
  return PADROES_A_RECEBER.some(pattern =>
    typeof pattern === 'string'
      ? rowText.includes(pattern) 
      : pattern.test(rowText)
  ) && !rowText.includes('PAGAR');
}

// FUNÇÃO DE VALIDAÇÃO DE VALOR MONETÁRIO
function isMonetaryValue(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  
  const patterns = [
    /^R\$\s*[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/,    // R$ 1.234.567,89
    /^[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$/,          // 1.234.567,89
    /^[\d]+,[\d]{2}$/,                            // 12345,89
    /^R\$\s*[\d.,]+$/,                            // R$ com variações
    /^-?[\d.,]+$/,                                // Números com pontos/vírgulas
    /^\(.*\)$/                                    // Valores negativos em parênteses
  ];
  
  return patterns.some(pattern => pattern.test(trimmed)) && /\d/.test(trimmed);
}

// FUNÇÃO DE PARSING DE VALOR MONETÁRIO BRASILEIRO
function parseMonetaryValue(str: any): number {
  if (!str) return 0;
  
  let cleanValue = str.toString().trim();
  let isNegative = false;
  
  // Tratar parênteses (valores negativos)
  if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
    isNegative = true;
    cleanValue = cleanValue.slice(1, -1);
  }
  
  // Remover símbolos de moeda
  cleanValue = cleanValue.replace(/[R$\s()]/g, '');
  
  // Tratar sinal negativo
  if (cleanValue.startsWith('-')) {
    isNegative = true;
    cleanValue = cleanValue.substring(1);
  }
  
  // LÓGICA ESPECÍFICA PARA FORMATO BRASILEIRO
  if (cleanValue.includes(',') && cleanValue.includes('.')) {
    // Formato: 1.234.567,89
    const lastComma = cleanValue.lastIndexOf(',');
    const lastDot = cleanValue.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else {
      cleanValue = cleanValue.replace(/,/g, '');
    }
  } else if (cleanValue.includes(',')) {
    // Formato: 12345,89 ou 1.234,89
    const parts = cleanValue.split(',');
    if (parts[1] && parts[1].length <= 2) {
      cleanValue = cleanValue.replace(',', '.');
    }
  }
  
  const result = parseFloat(cleanValue) || 0;
  return isNegative ? -result : result;
}

// FUNÇÃO DE EXTRAÇÃO DE VALORES MONETÁRIOS
function extrairValorMonetario(row: any[], rows: any[][], currentIndex: number): number {
  // ESTRATÉGIA 1: Buscar na mesma linha
  for (const cell of row) {
    if (isMonetaryValue(cell)) {
      const value = parseMonetaryValue(cell);
      if (value > 0) return value;
    }
  }
  
  // ESTRATÉGIA 2: Buscar nas próximas 5 linhas
  for (let offset = 1; offset <= 5; offset++) {
    const nextRow = rows[currentIndex + offset];
    if (!nextRow) break;
    
    for (const cell of nextRow) {
      if (isMonetaryValue(cell)) {
        const value = parseMonetaryValue(cell);
        if (value > 0) return value;
      }
    }
  }
  
  // ESTRATÉGIA 3: Padrão CSV específico (col2=TOTAL, col3=valor)
  if (row.length >= 4) {
    const col2Text = row[2]?.toString().toUpperCase() || '';
    const col3Value = row[3]?.toString() || '';
    
    if (col2Text.includes('TOTAL') && isMonetaryValue(col3Value)) {
      return parseMonetaryValue(col3Value);
    }
  }
  
  return 0;
}

// FUNÇÃO DE EXTRAÇÃO DE TRANSAÇÕES POR DATA
function extrairTransacoesPorData(row: any[], documentDates: Map<string, number>): void {
  if (!row || row.length < 2) return;
  
  // Buscar datas no formato brasileiro
  for (let i = 0; i < row.length; i++) {
    const cell = row[i]?.toString().trim();
    if (!cell) continue;
    
    // Padrões de data brasileira
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{1,2})-(\d{1,2})-(\d{4})/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = cell.match(pattern);
      if (match) {
        const dateKey = match[0];
        
        // Buscar valor monetário na mesma linha
        for (let j = i + 1; j < row.length; j++) {
          const valueCell = row[j];
          if (isMonetaryValue(valueCell)) {
            const value = parseMonetaryValue(valueCell);
            if (value > 0) {
              documentDates.set(dateKey, (documentDates.get(dateKey) || 0) + value);
              return;
            }
          }
        }
      }
    }
  }
}

// FUNÇÃO DE CRIAÇÃO DO RESUMO FINAL
function criarResumoFinal(
  branches: ResumoFilial[], 
  documentDates: Map<string, number>, 
  grandTotalAPagar: number, 
  grandTotalAReceber: number
): DadosResumo {
  const dateSpecificTotals: DateTotal[] = Array.from(documentDates.entries()).map(([date, total]) => ({
    date,
    total
  }));
  
  return {
    branches,
    dateSpecificTotals,
    grandTotal: grandTotalAPagar + grandTotalAReceber,
    grandTotalAPagar,
    grandTotalAReceber
  };
}

// FUNÇÃO PRINCIPAL DE PROCESSAMENTO
export function processarResumoFiliais(files: Express.Multer.File[]): DadosResumo {
  const branches: ResumoFilial[] = [];
  let grandTotalAPagar = 0;
  let grandTotalAReceber = 0;
  const documentDates = new Map<string, number>();
  
  for (const file of files) {
    try {
      // PASSO 1: DECODIFICAR ARQUIVO COM MÚLTIPLAS CODIFICAÇÕES
      const csvContent = decodificarArquivo(file);
      
      // PASSO 2: PARSE DO CSV SEM HEADERS
      const parseResult = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
      const rows = parseResult.data as any[][];
      
      // PASSO 3: EXTRAIR NOME DA FILIAL
      const branchName = extrairNomeFilial(rows, file.originalname || 'arquivo.csv');
      
      // PASSO 4: BUSCAR TOTAIS ESPECÍFICOS NAS LINHAS
      let totalAPagar = 0;
      let totalAReceber = 0;
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const rowText = row.join(' ').toUpperCase();
        
        // BUSCA TOTAL A PAGAR
        if (isAPagarTotalRow(rowText)) {
          const valor = extrairValorMonetario(row, rows, i);
          if (valor > totalAPagar) { // Pegar o maior valor encontrado
            totalAPagar = valor;
          }
        }
        
        // BUSCA TOTAL A RECEBER
        if (isAReceberTotalRow(rowText)) {
          const valor = extrairValorMonetario(row, rows, i);
          if (valor > totalAReceber) { // Pegar o maior valor encontrado
            totalAReceber = valor;
          }
        }
        
        // EXTRAIR TRANSAÇÕES INDIVIDUAIS POR DATA
        extrairTransacoesPorData(row, documentDates);
      }
      
      // PASSO 5: ADICIONAR À LISTA DE FILIAIS
      branches.push({
        name: branchName,
        totalAPagar,
        totalAReceber,
        total: totalAPagar + totalAReceber
      });
      
      grandTotalAPagar += totalAPagar;
      grandTotalAReceber += totalAReceber;
      
    } catch (error) {
      console.error(`Erro ao processar arquivo ${file.originalname}:`, error);
      // Continuar com outros arquivos
    }
  }
  
  return criarResumoFinal(branches, documentDates, grandTotalAPagar, grandTotalAReceber);
}