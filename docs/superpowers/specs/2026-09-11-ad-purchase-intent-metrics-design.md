# Especificação de Design: Métrica de Intenção de Compra da Propaganda (LinkHub)

**Data:** 11/09/2026  
**Status:** Aprovado em Brainstorming  
**Contexto:** O LinkHub possui um sistema de anúncio/propaganda modal (estilo Shopee), mas os cliques no botão de compra/oferta não eram contabilizados nas métricas de conversão do painel administrativo.

---

## 1. Visão Geral
Adicionar o rastreamento e exibição analítica de **Intenção de Compra** referente ao link de propaganda/anúncio. O sistema contabilizará cada clique realizado no botão de ação da oferta ("Aproveitar na Shopee") e apresentará no painel de métricas o volume absoluto de cliques e a taxa de conversão em relação às visualizações totais.

---

## 2. Requisitos e Comportamento

### 2.1 Rastreamento do Evento (Tracking)
- **Local do disparo:** Função `handleAdCtaClick` no componente [Preview.tsx](file:///c:/Users/nayla/.antigravity/LinkHub/src/components/Preview.tsx).
- **Callback:** Chamada de `onAdClick?.()` ou `onLinkClick?.('__advertisement__')`.
- **Persistência no Firestore:**
  - Gravado na coleção já existente `cliques`.
  - Objeto gravado:
    ```typescript
    {
      linkId: '__advertisement__',
      isAd: true,
      title: data.ad?.title || 'Oferta Shopee',
      time: Date.now()
    }
    ```
  - **Segurança & Compatibilidade:** Como a coleção `cliques` já possui `allow create: if true` em `firestore.rules`, não há necessidade de migração de regras nem risco de bloqueio de permissão.

### 2.2 Agregação e Cálculo de Métricas ([Editor.tsx](file:///c:/Users/nayla/.antigravity/LinkHub/src/components/Editor.tsx))
- **Métricas calculadas:**
  - `adClicks`: Total de cliques no anúncio (`count` no Firestore ou agregação na coleção `cliques` onde `linkId === '__advertisement__'`).
  - `adConversionRate`: Taxa percentual calculada por `(adClicks / views) * 100`, formatada com 1 casa decimal (ex: `14.2%`). Caso `views === 0`, taxa é `0%`.
- **Suporte offline/sem Firebase:** Fallback gracioso retornando 0 cliques e 0% de conversão quando o Firebase não estiver configurado.

### 2.3 Interface do Usuário na Aba Métricas
1. **Card de Destaque no Topo:**
   - Posicionado logo abaixo do resumo geral de métricas.
   - Design temático em gradiente sutil com acentos em laranja/âmbar (`#ee4d2d`), remetendo ao anúncio/Shopee.
   - Ícone `ShoppingBag` estilizado com badge de "Intenção de Compra".
   - Exibição em números grandes: total de cliques e a porcentagem de conversão de visitantes.
2. **Destaque no Ranking de Cliques por Link:**
   - Se houver cliques na propaganda ou se o anúncio estiver configurado, exibir um item especial com tag `🔥 Oferta / Propaganda` destacando o desempenho da propaganda frente aos demais links da bio.

---

## 3. Arquitetura de Componentes & Arquivos Afetados
- [src/components/Preview.tsx](file:///c:/Users/nayla/.antigravity/LinkHub/src/components/Preview.tsx): Inclusão do disparo de clique analítico no CTA da propaganda (`handleAdCtaClick`).
- [src/App.tsx](file:///c:/Users/nayla/.antigravity/LinkHub/src/App.tsx): Propagação do evento de clique na propaganda para persistência no Firebase (`addDoc` na coleção `cliques`).
- [src/components/Editor.tsx](file:///c:/Users/nayla/.antigravity/LinkHub/src/components/Editor.tsx):
  - Consulta do total de cliques da propaganda no `fetchMetrics`.
  - Renderização do Card de Intenção de Compra e da linha temática no ranking.
