# Documento de Ciência e Exceção de Segurança (Security Waiver)

**Data:** 15/09/2026  
**Responsável:** naylanmoreira350@gmail.com (Proprietário do Projeto)  
**Referência:** Auditoria Técnica Deep Dive - LinkHub (Edição 01 - 15 Set 2026)

## 1. Contexto das Vulnerabilidades
A auditoria de código identificou vulnerabilidades CRÍTICAS relacionadas à arquitetura de autenticação e acesso ao banco de dados:

1. **Firestore World-Writable (Issue 1.1 / firestore.rules):** As regras do Firebase estão configuradas para permitir leitura e escrita públicas (`allow read, write: if true;`) nas coleções fundamentais (`links`, `temas`, `perfil`, `anuncios`, `media_chunks`).
2. **Admin Auth Bypassable (Issue 2.4 / App.tsx):** A autenticação do painel administrativo é validada no lado do cliente com base em uma chave estática no `localStorage` (`linkhub_admin_email`), o que permite que qualquer visitante utilize as ferramentas de desenvolvedor (DevTools) para burlar a camada de login.

## 2. Decisão e Autorização
Eu, como proprietário e responsável pelo projeto, declaro que **estou totalmente ciente** dos riscos apontados pela auditoria (incluindo exposição de dados, possibilidade de defacement, injeção de conteúdos maliciosos por terceiros e abusos de cota do Firebase).

Apesar dos riscos, **solicito expressamente que a implementação atual seja mantida**. A migração para o Firebase Auth e a restrição do `firestore.rules` serão ignoradas/postergadas por necessidade operacional do projeto neste momento. 

## 3. Diretrizes para o Desenvolvimento
- O arquivo `firestore.rules` **não deve ser alterado** para bloquear o acesso público.
- A lógica de autenticação atual (via `localStorage` e client-side routing) **deve ser preservada**.
- O sistema continuará a operar com este nível de segurança até que uma nova diretriz substitua este documento.
