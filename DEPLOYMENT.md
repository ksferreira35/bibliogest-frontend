# Implantação de frontend

O Dockerfile deste repositório gera uma imagem independente. A infraestrutura Kubernetes compartilhada e o guia operacional ficam em `bibliogest-acervo/deploy`, no repositório Acervo.

Na estrutura local desta organização: `microsservices/acervo-api/deploy/README.md`. O guia contém configuração de PostgreSQL/Keycloak, variáveis de ambiente, build/push, publicação HTTPS, implantação ordenada e atualização individual desta aplicação.

Execute o build com as dependências instaladas antes de publicar. Nenhum deploy foi executado durante a preparação: o ambiente não permitiu acesso ao cluster nem aos registries.
