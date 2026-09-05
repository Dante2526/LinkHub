# Reposicionamento Interativo do Fundo de Tema (Mobile & Desktop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário ajuste interativamente a posição do fundo (imagem ou vídeo) via clique/arrasto no Preview e via sliders finos na aba Tema, com suporte a posições independentes para Mobile e Desktop.

**Architecture:** Ampliar o tipo `Theme` com coordenadas percentuais X/Y independentes para Mobile e Desktop. Criar camada de arraste interativo em `Preview.tsx` e controles manuais em `Editor.tsx`, orquestrados por `App.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React.

## Global Constraints
- Suportar tanto `image` quanto `video` no background.
- Valores de coordenadas X e Y delimitados estritamente entre 0 e 100 (%).
- Manter compatibilidade com temas já existentes (fallback para 50% 50%).

---

### Task 1: Modelo de Tipos
**Files:**
- Modify: `src/types.ts`

- [ ] **Passo 1: Adicionar interface `BackgroundPosition` e atualizar `Theme`**
- [ ] **Passo 2: Atualizar `defaultTheme` com os valores padrão de posição**
- [ ] **Passo 3: Validar com `npm run lint`**
- [ ] **Passo 4: Commit das alterações de tipo**

### Task 2: Reposicionamento no Preview
**Files:**
- Modify: `src/components/Preview.tsx`

- [ ] **Passo 1: Adicionar props de modo de preview e reposicionamento**
- [ ] **Passo 2: Implementar cálculo de estilo dinâmico para backgroundPosition e objectPosition**
- [ ] **Passo 3: Adicionar camada de captura de arrasto (`onPointerDown/Move/Up`)**
- [ ] **Passo 4: Adicionar barra flutuante de controles no Preview ([✓ Concluir], [↺ Centralizar])**
- [ ] **Passo 5: Validar com `npm run lint`**
- [ ] **Passo 6: Commit das alterações do Preview**

### Task 3: Controles na Aba Tema do Editor
**Files:**
- Modify: `src/components/Editor.tsx`

- [ ] **Passo 1: Receber props de modo de preview e estado de reposicionamento**
- [ ] **Passo 2: Adicionar botão "Ajustar Enquadramento no Preview" na aba Tema**
- [ ] **Passo 3: Adicionar sliders X e Y e botões de atalho (Topo, Centro, Base)**
- [ ] **Passo 4: Validar com `npm run lint`**
- [ ] **Passo 5: Commit das alterações do Editor**

### Task 4: Integração no App.tsx e Página Pública
**Files:**
- Modify: `src/App.tsx`

- [ ] **Passo 1: Gerenciar estado `isRepositioning` no `EditorView`**
- [ ] **Passo 2: Atualizar `PublicView` com detecção de tela responsiva (`< 768px`)**
- [ ] **Passo 3: Validar compatibilidade no `onSnapshot` do Firestore**
- [ ] **Passo 4: Validar com `npm run lint` e `npm run build`**
- [ ] **Passo 5: Commit da integração final**
