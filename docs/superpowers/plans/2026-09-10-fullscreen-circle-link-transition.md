# Plano de Implementação - Transição Circular em Tela Inteira ao Clicar em Links

> **Para executores:** HABILIDADE OBRIGATÓRIA: Utilize `executing-plans` para implementar este plano tarefa por tarefa. As etapas usam a sintaxe de caixa de seleção (`- [ ]`) para acompanhamento.

**Objetivo:** Criar e integrar uma animação de transição circular em tela inteira (estilo PAINEL-DSS) que se origina no ponto clicado de qualquer link e se expande até cobrir a tela antes da abertura do link.

**Arquitetura:** Componente modular `FullscreenCircleTransition` integrado dentro do container do `Preview`, ativado via callback nos cards de link com coordenadas relativas e cor dinâmica, acionando a navegação após a conclusão do ciclo de expansão (450ms).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Framer Motion, Vite.

---

## Tarefas

### Tarefa 1: Criar Componente `FullscreenCircleTransition`
**Arquivos:**
- Criar: `src/components/FullscreenCircleTransition.tsx`

- [ ] **Etapa 1: Implementar o componente de overlay e animação circular**
  - Receber `trigger: { x: number; y: number; color: string } | null` e callback `onComplete`.
  - Calcular raio máximo até os quatro cantos do container:
    $$R = \sqrt{\max(x, W - x)^2 + \max(y, H - y)^2}$$
  - Renderizar overlay com `clip-path` expansivo de `circle(0px at x y)` para `circle(R at x y)`.
  - Animação com duração de 0.5s e easing suave.

---

### Tarefa 2: Adicionar Keyframes e Estilos em `src/index.css`
**Arquivos:**
- Modificar: `src/index.css`

- [ ] **Etapa 1: Adicionar regras de `clip-path` e aceleração por GPU para a transição**
  - Adicionar `@keyframes fullscreen-circle-expand` caso seja usado via CSS nativo para máximo desempenho de 60fps.

---

### Tarefa 3: Integrar no `src/components/Preview.tsx`
**Arquivos:**
- Modificar: `src/components/Preview.tsx`

- [ ] **Etapa 1: Adicionar estado e container de transição no `Preview`**
  - Manter ref do container principal para calcular $(x, y)$ relativo.
  - Conectar callback `onTriggerTransition` em `LinkItemCard` e CTA do anúncio.
- [ ] **Etapa 2: Sincronizar o delay de abertura do link (450ms) com a expansão total**
  - Acionar `window.open(url, '_blank')` exatamente quando a tela estiver coberta.
  - Desmontar/esmaecer o overlay suavemente em seguida.

---

### Tarefa 4: Validação e Teste
**Arquivos:**
- Validação no build e visualização em execução.

- [ ] **Etapa 1: Executar checagem de tipos e lint**
  - Rodar `npm run lint` ou `npx tsc --noEmit`.
- [ ] **Etapa 2: Validar o comportamento visual no Preview**
  - Confirmar que o círculo nasce no clique e cobre a tela inteira com fluidez.
