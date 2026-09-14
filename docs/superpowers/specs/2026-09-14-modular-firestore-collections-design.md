# Especificação de Design: Coleções Modulares no Firestore

## 1. Visão Geral e Objetivo
Desmembrar o documento monolítico `perfis/principal` em 4 coleções independentes no Firebase Firestore, garantindo isolamento total dos dados, operações atômicas por link e limpeza da coleção legada após a migração.

---

## 2. Nova Estrutura de Coleções

### 2.1. Coleção `links`
- Cada link cadastrado torna-se um documento individual com ID próprio: `links/{linkId}`.
- Campos do documento:
  - `id` (string): Identificador único.
  - `title` (string): Título do botão.
  - `url` (string): URL de destino.
  - `thumbnailUrl` (string): Ícone ou miniatura.
  - `thumbnailPosition` ('left' | 'right'): Posição do ícone.
  - `thumbnailShape` ('round' | 'rounded' | 'square' | 'match-card'): Formato do ícone.
  - `animation` (string): Tipo de animação.
  - `isVisible` (boolean): Visibilidade no perfil público.
  - `textColor` (string, opcional): Cor customizada do texto.
  - `buttonColor` (string, opcional): Cor customizada do botão.
  - `order` (number): Índice numérico para ordenação correta dos botões.
  - `updatedAt` (number): Timestamp da alteração.

### 2.2. Coleção `temas`
- Documento único: `temas/principal`.
- Campos:
  - Todos os atributos de visual e estilo (`backgroundType`, `backgroundColor`, `backgroundGradient`, `backgroundImageUrl`, `backgroundVideoUrl`, `backgroundPositionMobile`, `backgroundPositionDesktop`, `fontFamily`, `buttonStyle`, `buttonColor`, `buttonTextColor`, `buttonShadow`, `buttonRadius`, `linkFormat`, `avatarShape`, `profileTextColor`, `linkTextAlign`, `linkThumbnailPosition`, `linkThumbnailShape`, `updatedAt`).

### 2.3. Coleção `perfil`
- Documento único: `perfil/principal`.
- Campos:
  - `name` (string): Nome ou @.
  - `bio` (string): Biografia.
  - `avatarUrl` (string): URL ou base64 da foto.
  - `updatedAt` (number): Timestamp.

### 2.4. Coleção `anuncios`
- Documento único: `anuncios/principal`.
- Campos:
  - Configurações da oferta Shopee (`enabled`, `title`, `description`, `imageUrl`, `badgeText`, `buttonText`, `buttonUrl`, `price`, `originalPrice`, `timerSeconds`, `frequencyHours`, `updatedAt`).

---

## 3. Fluxo de Migração Automática e Exclusão Legada
1. Na inicialização do `App.tsx`, o sistema verifica se a nova estrutura já possui dados.
2. Se as novas coleções estiverem vazias e o documento antigo `perfis/principal` ainda existir:
   - Os links de `perfis/principal` são gravados individualmente em `links/{linkId}`.
   - O tema é gravado em `temas/principal`.
   - O perfil é gravado em `perfil/principal`.
   - O anúncio é gravado em `anuncios/principal`.
3. Assim que todas as gravações nas novas coleções forem confirmadas com sucesso:
   - O documento antigo é excluído via `deleteDoc(doc(db, 'perfis', 'principal'))`.
4. Os listeners de tempo real (`onSnapshot`) passam a escutar as novas coleções.

---

## 4. Atualização de Segurança (`firestore.rules`)
Adicionar regras explícitas para as novas coleções:
```rules
match /links/{linkId} {
  allow read, write: if true;
}
match /temas/{temaId} {
  allow read, write: if true;
}
match /perfil/{perfilId} {
  allow read, write: if true;
}
match /anuncios/{anuncioId} {
  allow read, write: if true;
}
```
