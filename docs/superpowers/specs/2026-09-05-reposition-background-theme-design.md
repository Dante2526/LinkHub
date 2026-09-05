# Especificação de Design: Reposicionamento Interativo do Tema de Fundo (Mobile & Desktop)

Data: 2026-09-05  
Status: Aprovado  

## 1. Visão Geral
Permitir que o usuário ajuste e reposicione interativamente (via clique e arraste ou sliders) o enquadramento da imagem ou vídeo de fundo do tema no LinkHub. Como smartphones (9:19 vertical) e monitores (widescreen horizontal) possuem proporções opostas, a funcionalidade suporta posições independentes para visualização Mobile e Desktop.

---

## 2. Requisitos & Casos de Uso

### Casos de Uso:
1. **Ajuste no Celular (Mobile):** Ao selecionar a aba "Mobile" no editor/preview, o usuário clica em "Ajustar Enquadramento", arrasta a imagem para focar na parte desejada (ex: rosto, personagem, arte principal) e clica em "Concluir".
2. **Ajuste no Computador (Desktop):** Ao alternar para "Desktop", o usuário ajusta o enquadramento ideal para telas horizontais sem afetar a configuração do celular.
3. **Página Pública:** Visitantes em celular visualizam o enquadramento mobile; visitantes em desktop visualizam o enquadramento desktop.

---

## 3. Arquitetura e Modelo de Dados

### Atualização no `Theme` (`src/types.ts`):
```typescript
export interface BackgroundPosition {
  x: number; // 0 a 100 (%)
  y: number; // 0 a 100 (%)
}

export interface Theme {
  // ... campos existentes
  backgroundPositionMobile?: BackgroundPosition;  // padrão { x: 50, y: 50 }
  backgroundPositionDesktop?: BackgroundPosition; // padrão { x: 50, y: 50 }
}
```

---

## 4. Componentes e Interação

### 4.1 `Preview.tsx`
- **Resolução de Estilo:**
  - Aplica `backgroundPosition: "${pos.x}% ${pos.y}%"` para imagens.
  - Aplica `objectPosition: "${pos.x}% ${pos.y}%"` para a tag `<video>`.
  - Resolução dinâmica: se estiver no preview ou na página pública, verifica a largura da tela / modo selecionado.
- **Modo de Reposicionamento Interativo:**
  - Ao ativar, adiciona uma camada com captura de ponteiro (`onPointerDown`, `onPointerMove`, `onPointerUp`).
  - Arrastar converte o delta de movimento (pixels) em variação percentual suave de X e Y (clamped entre 0% e 100%).
  - Barra de controle flutuante:
    - Indicador: "Ajustando: Mobile" ou "Ajustando: Desktop".
    - Botão **[✓ Concluir]** (sai do modo de ajuste).
    - Botão **[↺ Centralizar]** (reseta para 50% 50%).
  - Elementos de conteúdo (links e perfil) recebem `pointer-events-none` e opacidade reduzida (ex: `opacity-30`) para focar na imagem.

### 4.2 `Editor.tsx` (Aba Tema)
- Quando `backgroundType === 'image' || backgroundType === 'video'`:
  - Botão **"Ajustar Enquadramento"** com ícone `Move` para ativar o modo no Preview.
  - Sliders de ajuste fino (Horizontal X: 0% - 100%, Vertical Y: 0% - 100%).
  - Botões de alinhamento rápido (Topo: 50% 0%, Centro: 50% 50%, Base: 50% 100%).

### 4.3 `App.tsx` (Página Pública e Sincronização)
- Mantém o estado `isRepositioning` e o passa entre `Editor` e `Preview`.
- Na visualização pública, utiliza detecção de viewport (`window.matchMedia('(max-width: 768px)')`) para selecionar o ponto focal adequado.

---

## 5. Plano de Validação
1. Testar arraste suave no preview tanto no modo Mobile quanto no Desktop.
2. Confirmar que a posição do Mobile não sobrescreve a do Desktop.
3. Testar com imagens e vídeos de fundo.
4. Testar persistência no Firestore / LocalStorage.
5. Testar renderização na página pública alternando o tamanho da janela do navegador.
