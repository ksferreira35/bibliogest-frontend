# Contexto técnico — frontend-integracao-rest

Trechos temáticos do README da main. Confira o código e o README vigente se o contrato tiver mudado.

### Persistência e integração

O frontend não possui tabelas. Consulta as APIs por seus prefixos `/acervo/api/v1`, `/reservas/api/v1` e `/usuarios/api/v1`. Os esquemas PostgreSQL estão documentados nos três repositórios backend. O frontend não executa SQL; os controles de SQL Injection são responsabilidade dos repositories das APIs.

## Solicitante nas reservas

O balcão e o detalhe mostram `leitorNome`, retornado pela API de Reservas, inclusive quando o bibliotecário está vendo a reserva de outra pessoa. O nome do usuário logado só serve de alternativa quando o `leitorId` da reserva corresponde ao `sub` da própria sessão. O UUID do usuário não é mostrado como nome nem como campo de identificação na tela.

Para registros antigos sem nome, aparece **Nome não informado**, sem inventar a identidade ou substituir pelo nome do bibliotecário. A API grava o nome vindo do token validado no momento da solicitação. O ID continua no contrato da API e nas verificações de propriedade; não é segredo nem substitui autorização. Os nomes são renderizados como texto pelo React.

## Administração de contas

A aba **Usuários** aparece somente para ADMINISTRADOR. A role não implica BIBLIOTECARIO: uma conta administrativa sem esse perfil não recebe gestão do acervo nem balcão. O painel lista/pesquisa contas, cria leitores com senha temporária, promove/remove BIBLIOTECARIO, ativa/desativa contas, encerra sessões e consulta auditoria. Alterações exigem confirmação. A própria conta e contas protegidas não recebem esses comandos.

O frontend chama `usuariosUrl` em `/config.json` (produção) ou `/config.dev.json` (desenvolvimento), normalmente `/usuarios/api`. O client secret do serviço não pertence a esses arquivos. A API valida a role e a audiência independentemente da tela. Uma mudança de role remonta a área de trabalho, removendo o painel da sessão que perdeu a permissão.

A senha de criação fica apenas no estado temporário do formulário e é limpa ao fechar ou concluir. A conta inicia como LEITOR e troca a senha no primeiro acesso. JWTs já emitidos podem durar até expirar mesmo após encerrar sessões no Keycloak. Os testes Cypress usam fixtures, sem alterar contas reais.

No modo de desenvolvimento, o proxy de `/usuarios` aponta para a API local em `127.0.0.1:8082`, evitando administrar contas reais por acidente durante o desenvolvimento do painel. Os proxies legados de Acervo e Reservas mantêm sua configuração anterior. Para testes automatizados, o modo E2E não encaminha requisições às APIs reais.
