---
name: bibliogest-frontend
description: "Desenvolver e revisar o frontend React do BiblioGest: telas, integração REST, autenticação, estilos e testes."
---

# BiblioGest — Frontend

## Antes de alterar

- Leia o README, o workflow de CI e os arquivos de configuração da branch atual. A main pode estar atrás da versão implantada; confirme a base antes de implementar ou integrar alterações.
- Mantenha os contratos REST, os códigos HTTP e a autorização existentes; alterações de contrato precisam ser coordenadas com os consumidores.
- Preserve segredos em variáveis de ambiente ou referências a Secrets. Use valores fictícios nos exemplos e testes; não registre tokens, senhas ou dumps.
- Deploy em RKE2: valide os manifests, use imagens com tags identificáveis e confira prontidão após publicação autorizada. Não modifique produção ao desenvolver ou testar localmente.

## Interface

- Preserve a estrutura de navegação e os componentes existentes. Na edição acadêmica CEUB (quando presente), use Tailwind para layout e Materialize para componentes, com CSS próprio para identidade; preserve as preferências de tema e acessibilidade.
- O Keycloak controla login via OIDC/PKCE; mantenha tokens em memória e segredos administrativos fora do React. Envie access tokens somente às APIs configuradas. Roles no frontend controlam apresentação, enquanto a API autoriza operações.
- Mantenha CSP e cabeçalhos no Nginx; não enfraqueça a política para resolver erros de carregamento.
- Consulte os scripts em package.json. Execute npm ci, npm run lint e npm run build; quando disponíveis, execute Vitest com cobertura e Cypress. Preserve a meta de 80% e os testes de teclado, foco, contraste e layout móvel.
- Use mocks/dados fictícios para testes automatizados; não execute mutações contra o catálogo ou contas reais.
