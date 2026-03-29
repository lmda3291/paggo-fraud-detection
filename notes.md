# Paggo Fraud Detection — Notas de Desenvolvimento

## O que foi feito (em ordem)

### Setup inicial
- Next.js 14 + TypeScript + Tailwind CSS dark theme
- SQLite (better-sqlite3) com WAL mode
- Dataset: 7.800 transações sintéticas de Janeiro 2025
- 5 regras de detecção de fraude com scoring aditivo (0-100)
- Seed script: CSV → parse → compute risk scores → insert no SQLite

### Data Layer
- `lib/db.ts` — singleton SQLite, synchronous reads
- `lib/fraud-rules.ts` — 5 regras: Balance Drain (+40), Anomalous Amount (+25), Repeated Origin (+15), Suspicious Hours (+10), Round Amount (+5)
- `scripts/seed.ts` — pipeline CSV → análise → SQLite. Risk scores pré-computados no seed time

### API Routes
- `GET /api/transactions` — paginação, filtros (type, risk, date, search), sort com allowlist contra SQL injection
- `POST /api/chat` — streaming SSE com Claude Sonnet, context injection (não RAG)
- `POST /api/review` — atualiza reviewed_status (false_positive | confirmed_suspicious)
- `GET /api/account/[id]` — perfil completo da conta com transações, related accounts, timeline

### Frontend Components
- `KPICards.tsx` — 4 cards com animação count-up (easeOut cubic, 1.5s) + loading skeletons
- `Charts.tsx` — 3 gráficos Recharts: volume diário (bar), distribuição por tipo (donut), histograma de amounts
- `TransactionTable.tsx` — tabela com filtros, sort, paginação (50/page), export CSV, skeleton loading, empty state com "Clear Filters"
- `TransactionModal.tsx` — modal de detalhe da transação com balance before/after, rule explanations, botões FP/Sus
- `ChatPanel.tsx` — painel lateral com streaming AI, **context-aware** (detecta página atual via usePathname)
- `RulesInfoModal.tsx` — modal explicando as 5 regras com contagem de triggers

### Pages
- `/` (dashboard) — header, quick guide banner (4 cards clicáveis), KPIs, charts, table, chat
- `/account/[id]` — breadcrumb, header com risk level badge, 4 KPIs, timeline chart, tabbed tables (origin/dest), rule breakdown sidebar, related accounts sidebar

## Lógica importante

### `buildAccountContext()` em `app/api/chat/route.ts`
- Quando o analista está na página de uma conta, o ChatPanel envia `currentAccountId` pro API
- O API busca TODAS as transações daquela conta (como origin E destination)
- Injeta no contexto do Claude junto com o contexto global
- Permite perguntas como "what's suspicious here?" com resposta específica da conta

### `useCountUp()` hook em `KPICards.tsx`
- requestAnimationFrame loop com easeOut cubic: `1 - (1-t)^3`
- Cada KPI anima independentemente de 0 ao valor real em 1.5s

### Risk Score tooltip em `TransactionTable.tsx`
- Tooltip aparece ABAIXO do badge (não acima) pra não ser cortado
- Seta apontando pra cima (div rotacionada 45°)

### Quick Guide Banner em `app/page.tsx`
- 4 cards clicáveis: 3 fazem scrollIntoView("#transaction-table"), 1 dispara custom event "open-chat-panel"
- ChatPanel escuta esse evento via addEventListener

### Sort column allowlist em `app/api/transactions/route.ts`
- Proteção contra SQL injection — sortBy vem do query param e é interpolado no ORDER BY
- Validado contra array de colunas permitidas

## Comentários estratégicos adicionados
- `lib/fraud-rules.ts` — cada regra com reasoning financeiro (por que esse padrão indica fraude)
- `lib/db.ts` — por que SQLite, por que better-sqlite3 sync
- `app/api/chat/route.ts` — por que context injection vs RAG, o que cada dado injetado serve
- `app/api/transactions/route.ts` — allowlist SQL injection, paginação 50 (cognitive load)
- `scripts/seed.ts` — pipeline design, por que pré-computar scores

## Projeto movido
- De: `C:\Users\lucas\OneDrive\Desktop\Machine Learning\Nova pasta\Learning\Paggo Competition\paggo-fraud-detection`
- Para: `C:\Dev\paggo-fraud-detection`
- Motivo: OneDrive sincronizava o `.next` folder e corrompia o cache

## Próximos passos possíveis
- [ ] Deploy no Vercel (adicionar URL real no README)
- [ ] Adicionar testes (pelo menos API routes)
- [ ] Dark/light mode toggle
- [ ] Gráfico de network graph (connections entre contas)
- [ ] Exportar relatório PDF de uma conta investigada
- [ ] Filtro por reviewed_status na tabela (mostrar só pending, só confirmed, etc)
- [ ] Rate limiting no endpoint de chat
- [ ] Adicionar mais contexto temporal no chat (trends, comparação semana a semana)
- [ ] Mobile responsive — o chat panel e a tabela precisam de ajustes pra telas pequenas
- [ ] Métricas de performance dos analistas (quantas reviews/dia, tempo médio de review)

## Stack
| Tech | Versão |
|------|--------|
| Next.js | 14.2.35 |
| React | ^18 |
| TypeScript | ^5 |
| Tailwind CSS | ^3.4.1 |
| better-sqlite3 | ^12.8.0 |
| @anthropic-ai/sdk | ^0.80.0 |
| Recharts | ^3.8.1 |
| Lucide React | ^1.7.0 |
| PapaParse | ^5.5.3 |

## Como rodar
```bash
cd C:\Dev\paggo-fraud-detection
npm install
# Criar .env.local com ANTHROPIC_API_KEY=sk-ant-...
npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/seed.ts
npm run dev
```
