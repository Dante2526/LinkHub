# Plano de Implementação: Coleções Modulares no Firestore

> **Objetivo:** Desmembrar a persistência monolítica de `perfis/principal` para 4 coleções independentes (`links`, `temas`, `perfil`, `anuncios`), migrar dados existentes e deletar a coleção legada `perfis`.

---

### Tarefa 1: Atualização de Regras de Segurança
**Arquivo:** `firestore.rules`
- Adicionar regras para as coleções `links`, `temas`, `perfil` e `anuncios`.
- Manter permissão temporária de leitura/exclusão em `perfis` para permitir o expurgo da coleção legada.

---

### Tarefa 2: Módulo de Sincronização Granular no App.tsx
**Arquivo:** `src/App.tsx`
- Implementar listeners em tempo real (`onSnapshot`) para cada coleção modular:
  - Coleção `links` (com ordenação).
  - Documento `temas/principal`.
  - Documento `perfil/principal`.
  - Documento `anuncios/principal`.
- Implementar rotina de migração única:
  - Ler `perfis/principal`. Se existir, gravar nas novas coleções e em seguida executar `deleteDoc(doc(db, 'perfis', 'principal'))`.
- Adaptar as operações de escrita (`handleUpdateData`):
  - Atualizações de tema gravam apenas em `temas/principal`.
  - Atualizações de perfil gravam apenas em `perfil/principal`.
  - Atualizações de anúncio gravam apenas em `anuncios/principal`.
  - Adição, remoção ou reordenação de links operam na coleção `links`.

---

### Tarefa 3: Verificação de Tipos e Build de Produção
- Executar `npm run lint` (`tsc --noEmit`) para validar TypeScript.
- Executar `npm run build` para garantir que o bundle final seja compilado sem erros.
