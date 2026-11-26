---
name: frontend-keycloak-sessao
description: "Manter login OIDC, renovação, logout, visibilidade por roles e preferências de sessão no React."
---

# Frontend Keycloak Sessao

- Consulte `src/auth.js` e `src/hooks/useSession.js`. Use Keycloak JS com cliente público e PKCE S256; jamais inclua client secret administrativo no frontend.
- Mantenha access/refresh tokens em memória. `apiFetch` renova token e restringe envio à origem e ao prefixo de serviço configurados. Não registre tokens nem senhas, e não os coloque no localStorage.
- LEITOR consulta/reserva; BIBLIOTECARIO administra acervo e balcão; ADMINISTRADOR administra usuários. As roles podem coexistir; ADMINISTRADOR não implica BIBLIOTECARIO. Backend valida todas as permissões.
- Logout utiliza o fluxo do Keycloak e a URL de retorno da configuração. Formulário de criação limpa senha temporária ao concluir/fechar. Mantenha somente preferências de interface persistidas.
