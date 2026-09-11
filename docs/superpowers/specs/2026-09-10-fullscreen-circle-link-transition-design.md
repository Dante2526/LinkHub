# Especificação de Design: Transição Circular em Tela Inteira ao Clicar em Links (LinkHub)

**Data:** 10/09/2026  
**Status:** Aprovado em Brainstorming  
**Origem:** Inspirado na animação de transição circular (`circle-in` / `clip-path`) do projeto `PAINEL-DSS`.

---

## 1. Visão Geral
Quando o usuário clica em qualquer link ou botão de ação no LinkHub (tanto na visualização pública quanto no frame de preview mobile do painel administrativo), uma onda circular de transição (estilo a transição do PAINEL-DSS) nasce exatamente nas coordenadas $(x, y)$ do clique e se expande até cobrir a tela inteira antes do redirecionamento/abertura do link.

---

## 2. Requisitos e Comportamento

### 2.1 Ponto de Origem e Cálculo do Raio
- **Coordenadas ($x, y$):** Capturadas a partir de `e.clientX` e `e.clientY` (ou centro do elemento caso disparado via teclado).
- **Raio Final ($R$):**
  $$R = \sqrt{\max(x, W - x)^2 + \max(y, H - y)^2}$$
  onde $W$ e $H$ são a largura e altura do viewport/container de preview. Isso garante que o círculo cubra perfeitamente todos os 4 cantos da tela.

### 2.2 Efeito Visual e Animação
- **Técnica:** Overlay de tela inteira (`fixed` na página pública ou `absolute inset-0` no preview container) com animação `clip-path: circle(0px at x y)` até `clip-path: circle(R at x y)`.
- **Estilo & Cor:**
  - Cor de preenchimento inspirada no card do link clicado (`link.buttonColor || theme.buttonColor`) com acabamento vibrante e elegante.
  - Efeito de onda com borda luminosa sutil (glow/anel exterior).
- **Curva de Animação e Duração:**
  - Duração de expansão: `0.5s` a `0.55s`.
  - Timing: `cubic-bezier(0.4, 0, 0.2, 1)`.

### 2.3 Fluxo de Navegação
1. Clique no link capturado (`onPointerDown` / `onClick`).
2. Disparo imediato da expansão circular cobrindo a tela.
3. Ao atingir ~450ms (cobertura total), executa a navegação (`window.open` ou redirecionamento).
4. O overlay esmaece suavemente (`opacity: 0` em ~250ms) e é desmontado.

---

## 3. Arquitetura de Componentes
- `src/components/FullscreenCircleTransition.tsx`: Componente isolado e reutilizável que renderiza o overlay animado com coordenadas dinâmicas e cor customizável.
- `src/components/Preview.tsx`: Integrado ao container do Preview e aos cards `LinkItemCard` e modal de anúncio (CTA), repassando as coordenadas e disparando a transição.
- `src/index.css`: Definição de keyframes `@keyframes fullscreen-circle-in` e classes auxiliares de aceleração por hardware (`will-change: clip-path`).
