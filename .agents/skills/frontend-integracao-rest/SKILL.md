---
name: frontend-integracao-rest
description: "Integrar as telas com as APIs REST de Acervo, Reservas e Usuários e seus contratos."
---

# Frontend Integracao Rest

- Utilize `apiFetch` em `src/auth.js`, configuração de `public/config.json` ou `config.dev.json` e os prefixos de serviço definidos ali. Não crie chamadas diretas ao banco.
- Catálogo: pagine `/v1/obras`, use busca, categoria e resumo por IDs; exiba sinopse e capa retornadas pelo Acervo. Edição e envio de capa usam o contrato de cada endpoint.
- Reservas: disponibilidade vem do serviço de Reservas e usa exemplares do Acervo. Mostre `leitorNome`; só use o nome da sessão como fallback quando o identificador corresponde à própria conta. Não invente nome para registro antigo.
- Usuários: painel administrativo consulta e gerencia contas pela API de Usuários. Não chame a API administrativa do Keycloak pelo navegador. Trate respostas 401, 403, 404, 409 e indisponibilidade conforme o contrato.
- Vite em desenvolvimento pode apontar Acervo e Reservas à produção; use fixtures ou serviços isolados para testes de escrita. Usuários usa API local no proxy; o modo e2e não tem proxy real.

## Fluxo de trabalho e critérios de entrega

- Consulte o README do serviço proprietário antes de mudar formatos de payload, filtros, paginação ou códigos HTTP.
- Use configuração de ambiente e apiFetch; mantenha a paginação consistente e diferencie falha de integração de resultado vazio.
- Simule respostas no ambiente E2E e verifique que operações administrativas nunca são chamadas pelo teste contra contas reais.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Persistência e integração, Solicitante nas reservas, Administração de contas. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
