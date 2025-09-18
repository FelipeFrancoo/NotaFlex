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
