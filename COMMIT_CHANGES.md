# Commit: Correção de Formatação Excel e Novo Parser CSV

## 🔧 Principais Alterações

### 1. **Correção da Formatação Excel (4 colunas)**
- **Problema**: Tabelas de exportação estavam gerando 5 colunas (A, B, C, D, E) com coluna "Pendente" desnecessária
- **Solução**: Removida coluna E "Pendente" de todas as exportações Excel
- **Arquivos modificados**:
  - `pages/api/export-excel.ts`: Corrigidas todas as referências de `mergeCells` de `:E` para `:D`
  - `pages/api/export-excel-t014.ts`: Ajustadas formatações para 4 colunas

### 2. **Novo Parser CSV para "Contas a pagar- À vencer"**
- **Funcionalidade**: Parser especializado para extrair seção específica de relatórios CSV
- **Arquivos criados**:
  - `lib/parseContasAPagar.ts`: Implementação TypeScript com tokenizador CSV robusto
  - `lib/parseContasAPagar.js`: Versão JavaScript para execução direta
  - `scripts/runContasAPagar.mjs`: Script de execução
- **Novo comando npm**: `npm run contas:parse -- "arquivo.csv"`

### 3. **Melhorias de Documentação**
- **README.md atualizado** com:
  - Seção sobre parser rápido `contas:parse`
  - Instruções de uso e exemplos
  - Diferenciação entre parser completo (`extract_data.js`) e parser simples

### 4. **Estrutura de Dados Padronizada**
- **Output do parser**: 
  ```json
  {
    "Vencimento": "02/09/2025",
    "Transacionador": "EMPRESA LTDA",
    "Documento": "12345",
    "Valor": "R$1.000,00"
  }
  ```

## 🎯 Benefícios das Mudanças

1. **Excel Limpo**: Tabelas agora têm exatamente 4 colunas necessárias
2. **Parser Rápido**: Extração direta da seção "Contas a pagar" sem processamento extra
3. **Melhor Usabilidade**: Comando `npm run contas:parse` para uso imediato
4. **Código Robusto**: Tokenizador CSV que lida com vírgulas em descrições

## 🧪 Testes Realizados

- ✅ Parser testado com arquivo real: `T014_VisaoGeralFluxoCaixaDetalhado (3)_1756835522624.csv`
- ✅ Exportação Excel validada com formatação de 4 colunas
- ✅ Servidor funcionando corretamente em `localhost:3003`
- ✅ Ignoração automática de linhas de totais diários

## 🔄 Compatibilidade

- **Backward Compatible**: Funcionalidades existentes mantidas
- **Novos recursos**: Adicionais sem quebrar funcionalidades atuais
- **TypeScript**: Tipagem completa para parser e interfaces

## 📝 Uso Rápido

```bash
# Parser rápido para seção específica
npm run contas:parse -- "arquivo.csv"

# Servidor de desenvolvimento
npm run dev
```

---

**Resumo**: Correção de formatação Excel (5→4 colunas) + novo parser CSV especializado para "Contas a pagar- À vencer" com comando npm dedicado.