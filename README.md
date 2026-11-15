# BiblioGest — Frontend

Interface web em React e Vite para leitores e bibliotecários.

## Rodar no computador

Com Node.js 24 instalado, rode na raiz do repositório.

```bash
npm ci
npm run dev
```

Abra a URL que o Vite mostrar, normalmente [localhost:5173](http://localhost:5173/). O `public/config.json` vem com o endereço do Keycloak em branco. Assim, você pode trabalhar na interface local. Para conferir o login integrado, use o [BiblioGest publicado](https://bibliogest.ksferreira.org/). O login no Vite depende de um cliente Keycloak de desenvolvimento que autorize a URL local.

Antes de abrir um pull request, rode `npm run lint` e `npm run build`.
