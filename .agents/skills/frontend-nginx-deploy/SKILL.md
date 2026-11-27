---
name: frontend-nginx-deploy
description: "Manter build Docker, Nginx, CSP, configuração pública e integração de deploy frontend no Kubernetes."
---

# Frontend Nginx Deploy

- Consulte `Dockerfile`, `nginx.conf`, `security-headers.conf`. Nginx serve build estático Vite como usuário sem privilégios. Preserve cabeçalhos de segurança também em recursos com cache e /config.json.
- CSP parte de default-src none e autoriza somente as origens necessárias para scripts, estilos, fontes, imagens, conexões e formulários; não introduza curingas, unsafe-inline ou unsafe-eval para contornar um erro.
- Frontend e APIs compartilham a origem pública via Traefik; configuração runtime vem do ConfigMap. Nunca inclua segredos, backups, .env reais ou relatórios no contexto Docker.
- O tema de login CEUB do Keycloak tem código próprio em `keycloak-theme/` e distribuição JAR separada. Preserve o tema de portfólio. Não altere realm, credenciais ou produção como parte de um build local.
- Quando autorizado a publicar, valide imagem e rollout, verifique a página pública e permita retornar à imagem anterior.

## Fluxo de trabalho e critérios de entrega

- Antes de ajustar Nginx, compare as localidades com cache e a configuração runtime, para que os cabeçalhos continuem presentes.
- Autorize somente os recursos necessários; se uma mudança introduzir origem adicional, explique por que é necessária e mantenha a política restritiva.
- Valide build local e configuração; publicação exige autorização própria. Depois de uma publicação autorizada, confira readiness e HTML servido sem alterar serviços vizinhos.

## Referência do projeto

Consulte [contexto técnico](references/contexto.md) para CSP, Build e publicação, Arquitetura do BiblioGest. Use o [README do repositório](../../../README.md) e o código da branch atual como fontes de verdade.
