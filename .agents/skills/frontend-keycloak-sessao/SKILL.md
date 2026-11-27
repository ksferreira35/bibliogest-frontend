---
name: frontend-keycloak-sessao
description: "Manter login OIDC, renovação, logout, visibilidade por roles e preferências de sessão no React."
---

# Frontend Keycloak Sessao

- Consulte `src/auth.js` e `src/hooks/useSession.js`. Use Keycloak JS com cliente público e PKCE S256; jamais inclua client secret administrativo no frontend.
- Mantenha access/refresh tokens em memória. `apiFetch` renova token e restringe envio à origem e ao prefixo de serviço configurados. Não registre tokens nem senhas, e não os coloque no localStorage.
- LEITOR consulta/reserva; BIBLIOTECARIO administra acervo e balcão; ADMINISTRADOR administra usuários. As roles podem coexistir; ADMINISTRADOR não implica BIBLIOTECARIO. Backend valida todas as permissões.
- Logout utiliza o fluxo do Keycloak e a URL de retorno da configuração. Formulário de criação limpa senha temporária ao concluir/fechar. Mantenha somente preferências de interface persistidas.

## Fluxo de trabalho e critérios de entrega

- Confira estado autenticado, roles efetivas e destino de chamadas antes de renderizar ações. O servidor é a autoridade para cada operação.
- Preserve o fluxo de login/logout do Keycloak e o armazenamento exclusivo de preferências; nenhum token deve aparecer no localStorage.
- Teste sessão inválida, perda de role e renovação usando fixtures; não use credenciais de produção.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para Fluxo de autenticação, Autenticação e CORS, Matriz de permissões. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
