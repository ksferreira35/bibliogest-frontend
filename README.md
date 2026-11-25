# BiblioGest — Frontend

Interface em React e Vite para leitores e bibliotecários. O catálogo, exemplares e circulação são carregados das APIs institucionais; não há backend ou catálogo local no frontend.

## Desenvolvimento local

Com Node.js 24 e npm instalados, na raiz do repositório:

```bash
npm ci
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173/). O modo de desenvolvimento carrega `public/config.dev.json` e encaminha `/acervo` e `/reservas` para `https://bibliogest.ksferreira.org`, com `changeOrigin` habilitado. O login usa Keycloak com PKCE e mantém o access token em memória para as chamadas autenticadas.

No cliente `bibliogest-react` do realm `bibliogest`, permita `http://localhost:5173/*` em **Valid Redirect URIs** e `http://localhost:5173` em **Valid Post Logout Redirect URIs**. Configure **Web Origins** como `http://localhost:5173`. O endereço de retorno depois de sair está em `logoutRedirectUri` no `config.dev.json`.

`public/config.json` é a configuração padrão de produção e não contém endereço de Keycloak local nem segredo de cliente. Não coloque `client_secret` no frontend.

## Verificações

Antes do pull request, execute `npm run lint`, `npm test` e `npm run build`. O CI executa essas etapas em sequência.

A navegação administrativa exige a role `BIBLIOTECARIO`. A API continua responsável por autorizar cada operação. O token fica em memória; não há segredo de cliente no navegador.

Em produção, `/config.json` é fornecido pelo ConfigMap `frontend-config` do RKE2. As URLs públicas de Keycloak e das APIs são configuração pública; senhas, tokens e chaves privadas não entram no frontend. O logout volta à origem publicada da aplicação.

A imagem pode ser construída com `docker build -t bibliogest-frontend:0.1.2 .`. O estágio final contém somente o site compilado e a configuração do Nginx; README, configurações de desenvolvimento e arquivos `.env` ficam fora do contexto Docker.
