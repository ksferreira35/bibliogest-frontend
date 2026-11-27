---
name: frontend-testes-ci
description: "Executar e ampliar testes React, Vitest, Cypress, axe-core, Oxlint e pipeline GitHub Actions."
---

# Frontend Testes Ci

- Execute `npm run lint`, `npm run test:coverage` e `npm run build`. Vitest + Testing Library mede linhas, statements, branches e funções; cada métrica precisa atingir 80% sem excluir lógica importante.
- Para E2E: `npm run dev:e2e` e, em outro terminal, `npm run test:e2e -- --browser chrome --headless`. Use fixtures e interceptações em `cypress/e2e/`.
- Adapter Keycloak simulado existe somente no modo E2E, que não pode gerar build de produção. Verifique login/logout, perfis, catálogo, reservas, usuários, persistência visual e acessibilidade sem contas reais.
- Workflow segue lint → cobertura → E2E → build. Use relatórios de coverage e screenshots de falhas; corrija regressões mantendo assertions significativas.

## Fluxo de trabalho e critérios de entrega

- Use testes de componente para regras locais e E2E para a integração visível. Quando alterar funções ou condições, confira a cobertura V8 nas quatro métricas.
- Preserve a ordem dos jobs no CI: lint, testes/cobertura, Cypress e build. Consulte artefatos e mensagens de falha antes de mudar regras.
- Não use o adapter E2E no build final nem relaxe testes para contornar falhas reais.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Testes e cobertura. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
