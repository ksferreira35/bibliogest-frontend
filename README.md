# BiblioGest — Frontend

Interface em React e Vite para leitores e bibliotecários. O catálogo, exemplares e circulação são carregados das APIs institucionais; não há backend ou catálogo local no frontend.

## Desenvolvimento local

Com Node.js instalado, na raiz do repositório:

```bash
npm ci
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173/). O modo de desenvolvimento carrega `public/config.dev.json` e encaminha `/acervo` e `/reservas` para `https://bibliogest.ksferreira.org`, com `changeOrigin` habilitado. O login usa Keycloak com PKCE e mantém o access token em memória para as chamadas autenticadas.

`public/config.json` é a configuração padrão de produção e não contém endereço de Keycloak local nem segredo de cliente. Não coloque `client_secret` no frontend.
