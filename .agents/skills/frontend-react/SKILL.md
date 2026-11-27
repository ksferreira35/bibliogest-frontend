---
name: frontend-react
description: "Implementar telas, componentes e estado do frontend React do BiblioGest."
---

# Frontend React

- Consulte `src/App.jsx`, `src/components/`, `src/domain/` e `src/hooks/useSession.js` antes de criar abstrações. O frontend usa React 19, JavaScript com JSX e Vite; não tem backend próprio.
- Workspace mantém catálogo, reservas, gestão, balcão e usuários. Preserve a troca de área conforme a sessão e descarte estado administrativo quando a identidade ou as roles mudarem.
- Componentes de formulário recebem DTOs e callbacks; regras de apresentação de catálogo e circulação ficam nos módulos de domínio. Use texto renderizado pelo React, estados de carregamento, erro e vazio.
- Use Node.js 24 e `npm ci`; não altere contratos de APIs para acomodar uma tela sem coordenar os serviços.

## Fluxo de trabalho e critérios de entrega

- Antes de editar uma tela, identifique seu papel, o estado de carregamento e a API responsável; preserve composição de componentes e estados de erro e vazio.
- Confira a troca de identidade na sessão, renderização de dados como texto e estados de formulário após fechamento, logout ou perda de role.
- Valide o fluxo principal com Testing Library e, quando afetar a navegação, Cypress.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Organização do frontend, Matriz de permissões. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
