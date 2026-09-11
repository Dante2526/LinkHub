# Métricas de Intenção de Compra da Propaganda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rastrear os cliques no botão de compra do anúncio da Shopee/propaganda e exibir no painel de métricas o total de visitantes com intenção de compra e a taxa de conversão correspondente.

**Architecture:** Capturar o evento de clique no CTA do anúncio em `Preview.tsx` e persistir como evento analítico na coleção `cliques` do Firestore via `App.tsx`. Agregar os dados de cliques no anúncio e calcular a taxa percentual de conversão em `Editor.tsx`, renderizando um card premium temático e destacando o anúncio no ranking de links.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Firebase Firestore.

## Global Constraints
- Manter compatibilidade com a coleção `cliques` já autorizada em `firestore.rules`.
- Tratamento seguro de divisão por zero (`views === 0`).
- Sem degradação visual ou quebra de layout no mobile e desktop.
- `tsc --noEmit` deve passar sem erros.

---

### Task 1: Rastreamento do Clique no Anúncio (Preview e App)
**Files:**
- Modify: `src/components/Preview.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `handleAdCtaClick` no `Preview.tsx` invoca `onLinkClick?.('__advertisement__')`.
- `handleLinkClick` no `App.tsx` grava `{ linkId: '__advertisement__', isAd: true, title: data?.ad?.title || 'Oferta Shopee', time: Date.now() }`.

- [ ] **Passo 1: Chamar `onLinkClick?.('__advertisement__')` no `handleAdCtaClick` de `Preview.tsx`**
- [ ] **Passo 2: Tratar gravação específica para o anúncio no `handleLinkClick` de `App.tsx`**
- [ ] **Passo 3: Validar tipagem com `npm run lint`**
- [ ] **Passo 4: Commit das alterações do rastreamento**

### Task 2: Consulta e Agregação de Métricas no Editor
**Files:**
- Modify: `src/components/Editor.tsx`

**Interfaces:**
- Estado `metrics` estendido com `adClicks: number` e `adConversionRate: number`.
- `fetchMetrics` contabiliza cliques da propaganda e calcula a taxa percentual sobre visualizações.

- [ ] **Passo 1: Estender a interface do estado `metrics` no `Editor.tsx`**
- [ ] **Passo 2: Atualizar `fetchMetrics` com contagem de `adClicks` e cálculo de `adConversionRate`**
- [ ] **Passo 3: Validar com `npm run lint`**
- [ ] **Passo 4: Commit da camada de dados de métricas**

### Task 3: Card de Intenção de Compra e Destaque no Ranking
**Files:**
- Modify: `src/components/Editor.tsx`

**Interfaces:**
- Novo card visual com tema Shopee (`ShoppingBag`, total de cliques, taxa de conversão e badge).
- Destaque da propaganda com tag `🔥 Intenção de Compra` na lista de cliques por link.

- [ ] **Passo 1: Adicionar Card Temático de Intenção de Compra na aba `stats`**
- [ ] **Passo 2: Adicionar item de propaganda integrado ao ranking de links mais clicados**
- [ ] **Passo 3: Validar com `npm run lint` e `npm run build`**
- [ ] **Passo 4: Commit da interface de métricas**
