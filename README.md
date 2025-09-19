# NotaFlex

Sistema full-stack para processamento inteligente de relatórios CSV (contas a pagar e a receber), com:
- Upload de múltiplos arquivos
- Extração robusta de datas e valores (inclusive datas individuais por linha)
- Consolidação por filial e por dia
- Exportação para Excel com formatação
- Visualização no frontend com prévia dos dados

## Funcionalidades

- Upload de CSV com drag & drop e seleção múltipla
- Seleção do tipo de documento por arquivo (A Pagar / A Receber)
- Processamento com progresso e prévia dos dados
- Resumo consolidado de múltiplas filiais
- Totais por dia (inclui datas individuais extraídas das linhas dos CSV)
- Exportação de relatórios para Excel (por arquivo e resumo geral)

## Tecnologias

- Frontend: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query
- Backend: Express + TypeScript, PapaParse (CSV), ExcelJS (Excel)
- Organização: Monorepo (client + server + shared)
- Armazenamento atual: In-memory (MemStorage) com estrutura pronta para PostgreSQL/Drizzle

## Arquitetura e Arquivos Principais

- Frontend
  - Página principal (upload, processamento, resumos): [client/src/pages/home.tsx](client/src/pages/home.tsx)
  - Upload de arquivos: [client/src/components/file-upload.tsx](client/src/components/file-upload.tsx)
  - Prévia dos dados: [client/src/components/data-preview.tsx](client/src/components/data-preview.tsx)
  - API client: [client/src/lib/api.ts](client/src/lib/api.ts)
  - Bootstrap da app: [client/src/App.tsx](client/src/App.tsx), [client/src/main.tsx](client/src/main.tsx), [client/index.html](client/index.html)

- Backend
  - Rotas da API (upload, processamento, exportações): [server/routes.ts](server/routes.ts)
  - Armazenamento em memória (ProcessedData, DailySummary, BranchTotals): [server/storage.ts](server/storage.ts)

- Configuração
  - Vite (aliases: @, @shared, @assets): [vite.config.ts](vite.config.ts)
  - Tailwind: [tailwind.config.ts](tailwind.config.ts)
  - Scripts & deps: [package.json](package.json)

## Como rodar

1) Instalar dependências
```bash
npm install
```

2) Ambiente de desenvolvimento (server + frontend integrado)
```bash
npm run dev
```
- Porta padrão do servidor: PORT=3001 (configurada em [package.json](package.json))
- A aplicação web é servida pelo backend em modo dev

3) Build de produção
```bash
npm run build
npm run start
```

## Fluxo de Uso

- Acesse a aplicação
- Faça upload dos arquivos CSV
- Se necessário, marque o tipo de documento (A Pagar / A Receber) para cada arquivo
- Clique em “Processar”
- Visualize a prévia com totais por dia (incluindo todas as datas individuais dos documentos)
- Exporte para Excel

Para resumo consolidado de múltiplas filiais:
- Use a área “Resumo Geral de Relatórios” na página principal ([client/src/pages/home.tsx](client/src/pages/home.tsx))
- Faça upload de vários CSVs já consolidados por filial
- Processe e exporte “Resumo Total das Filiais”

## API (principais endpoints)

- GET /api/processed-data  
  Retorna o último processamento semanal (usado na prévia). Implementado em [server/routes.ts](server/routes.ts).

- POST /api/export-excel  
  Gera e baixa o Excel do processamento atual (formatação pronta). Implementado em [server/routes.ts](server/routes.ts).

- DELETE /api/clear-data  
  Limpa dados processados em memória (fluxo de reset). Implementado em [server/routes.ts](server/routes.ts).

- Upload/Resumo (endpoints internos do fluxo de upload/processamento e resumo consolidado) também estão em [server/routes.ts](server/routes.ts).

## Destaques Técnicos

- Extração de datas robusta:
  - Datas detectadas na primeira célula, em qualquer célula e no texto completo da linha
  - Captura de todas as datas individuais (p. ex. “01/09/2025”, “02/09/2025”, …)
  - Soma por dia e agrupamento em “dias úteis” e “final de semana”
- Excel profissional com ExcelJS:
  - Cabeçalhos com estilos consistentes
  - Totais por dia e por filial
  - Abas por arquivo e resumo consolidado
- UI/UX:
  - Drag & drop, progresso de processamento e toasts
  - Componentes reutilizáveis (shadcn/ui)

## Estrutura de Pastas (resumo)

```text
client/           # Frontend React
server/           # Backend Express
shared/           # Tipos/Schema compartilhados
attached_assets/  # Amostras CSV de teste
```

## Extração isolada da seção "Contas a pagar- À vencer"

Quando você precisa apenas extrair a tabela detalhada da seção "Contas a pagar- À vencer" de um CSV exportado (ignorar resumos e totais), use o utilitário `extract_data.js` na raiz.

### Como funciona
1. Localiza a primeira linha cuja primeira coluna seja exatamente `Contas a pagar- À vencer`.
2. Procura até 8 linhas acima um cabeçalho que contenha colunas variantes de `DATA`, `TRANSACIONADOR`, `DOCUMENTO`, `VALOR` (aceitando sufixos numéricos: `DATA6`, `DOCUMENTO4`, etc.).
3. Se não encontrar cabeçalho formal, aplica heurística de posições relativas.
4. Percorre linhas subsequentes enquanto a primeira coluna continua igual a `Contas a pagar- À vencer`.
5. Ignora automaticamente linhas de total diário (ex.: células contendo `Total 05/09/2025:`).
6. Retorna objetos normalizados:
   - `Vencimento` (DATA*)
   - `Transacionador` (TRANSACIONADOR*)
   - `Documento` (DOCUMENTO*)
   - `Valor` (valor monetário original)
   - `ValorNumber` (valor numérico parseado)

### Execução
```bash
node extract_data.js "attached_assets/T014_VisaoGeralFluxoCaixaDetalhado (1) (3)_1756494215537.csv" > saida.json
```

### Exemplo de saída (cortado)
```json
[
  {
    "Vencimento": "01/09/2025",
    "Transacionador": "GAIARDO COMERCIO E SERVICOS ELETRICOS LTDA",
    "Documento": "27920",
    "Valor": "R$10.166,67",
    "ValorNumber": 10166.67
  }
]
```

### Teste rápido
```bash
node test_t014_processing.js
```

O teste valida:
- Que pelo menos uma linha é extraída
- Que nenhum total diário foi incluído
- Que os campos exigidos estão presentes

### Parser rápido (script `contas:parse`)

Se você só precisa de uma saída JSON enxuta (sem `ValorNumber` e sem heurísticas extras) baseada exatamente nas linhas que começam com `Contas a pagar- À vencer`, use o script adicionado:

1. Executar:
```bash
npm run contas:parse -- "attached_assets/T014_VisaoGeralFluxoCaixaDetalhado (3)_1756835522624.csv"
```
2. Saída: array de objetos `{ Vencimento, Transacionador, Documento, Valor }`.
3. Linhas de totais ("Total dd/mm/yyyy:") são ignoradas automaticamente.

Use este modo quando quiser algo imediato e direto para integração ou inspeção rápida.

