# Passo a passo: Tela Fixa de Manutenção

## Resumo
A aplicação pública agora exibe uma tela de "Em Manutenção" com design moderno e animado (Tailwind/Lucide), preservando totalmente as rotas internas e painel administrativo, a fim de garantir que visitantes não vejam mudanças inacabadas em produção.

## Arquivos Modificados
1. **`src/components/Maintenance.tsx`** (NOVO)
   - Adicionada estrutura com Tailwind CSS (dark mode nativo).
   - Aplicadas animações de *pulse* e rotações (*spin*) em ícones (Cog, Hammer, Sparkles) para dar aparência viva à tela.
2. **`src/App.tsx`**
   - Importado o componente `Maintenance`.
   - Modificada a rota `/` (pública) para que ela aponte diretamente para o componente novo, substituindo a `PublicView`.
   - O código não-utilizado de `PublicView` foi comentado, permitindo fácil reversão no futuro quando a manutenção for encerrada sem acusar erros no TypeScript.

## Evidência de Sucesso
- `npm run lint` e `npm run build` foram executados com sucesso (código 0).
- Nenhuma dependência externa adicionada.
