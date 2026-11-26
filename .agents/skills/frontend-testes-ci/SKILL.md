---
name: frontend-testes-ci
description: "Executar e ampliar testes React, Vitest, Cypress, axe-core, Oxlint e pipeline GitHub Actions."
---

# Frontend Testes Ci

- Execute `npm run lint`, `npm run test:coverage` e `npm run build`. Vitest + Testing Library mede linhas, statements, branches e funções; cada métrica precisa atingir 80% sem excluir lógica importante.
- Para E2E: `npm run dev:e2e` e, em outro terminal, `npm run test:e2e -- --browser chrome --headless`. Use fixtures e interceptações em `cypress/e2e/`.
- Adapter Keycloak simulado existe somente no modo E2E, que não pode gerar build de produção. Verifique login/logout, perfis, catálogo, reservas, usuários, persistência visual e acessibilidade sem contas reais.
- Workflow segue lint → cobertura → E2E → build. Use relatórios de coverage e screenshots de falhas; corrija regressões mantendo assertions significativas.
