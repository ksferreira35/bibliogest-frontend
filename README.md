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

## Testes e cobertura

Use Node.js 24. Os testes não precisam de conta de produção, senha, token real ou banco de dados.

```bash
npm run lint
npm run test:coverage
npm run build
```

O Vitest executa testes de componentes, formulários, paginação, autenticação e permissões. O provider V8 mede todos os arquivos JavaScript/JSX de `src/`, incluindo a inicialização e os componentes sem teste direto. O comando falha se **qualquer uma** destas métricas ficar abaixo de 80%:

| Métrica | O que mede |
| --- | --- |
| Linhas | Linhas executáveis visitadas pelos testes |
| Statements | Instruções executadas |
| Funções | Funções chamadas |
| Branches | Alternativas percorridas em condições e decisões |

Abra `coverage/index.html` no navegador para consultar cada arquivo e as linhas que faltam testar. `coverage/lcov.info` permite integração com outros analisadores; `coverage/coverage-summary.json` contém os totais. Os relatórios são gerados localmente e ignorados pelo Git e pelo Docker. `npm test` roda a suíte sem medir cobertura; o CI usa `npm run test:coverage`.

80% de cobertura não significa 80% dos testes aprovados: todos os testes devem passar e o código executado precisa alcançar o mínimo em cada métrica. A configuração fica em `vitest.config.js`, sem excluir controllers de tela ou regras de acesso para elevar o percentual.

### Cypress: fluxos no navegador

O Cypress fica neste mesmo repositório. Em um terminal:

```bash
npm run dev:e2e
```

Em outro terminal:

```bash
npm run test:e2e -- --browser chrome --headless
```

Para abrir a interface interativa, use `npm run test:e2e:open`. O endereço de testes é `http://127.0.0.1:4173`. Instale o Chrome para o comando acima ou use o Electron incluído pelo Cypress (`npm run test:e2e`). No Linux, são necessárias as bibliotecas de navegador e um display ou Xvfb, conforme os [requisitos do Cypress](https://docs.cypress.io/app/get-started/install-cypress).

Os cenários de `cypress/e2e/bibliogest.cy.js` verificam entrada/saída, catálogo paginado, busca, sinopse, reserva, edição/exclusão pelo bibliotecário, ausência de comandos administrativos para o leitor e uso em tela pequena. `cypress-axe` verifica as regras automatizáveis WCAG 2 A/AA e 2.1 AA nas telas e diálogos visitados, sem ignorar violações para fazer o teste passar.

O servidor de testes substitui **somente nesse modo** o adapter do Keycloak por `cypress/support/keycloak.js`. As requisições são interceptadas pelo Cypress e recebem fixtures. Isso permite testar o frontend sem enviar dados ou credenciais à produção. O servidor E2E não tem proxy para as APIs reais. O build normal usa o Keycloak verdadeiro, e `vite build --mode e2e` é recusado. O adapter de teste não valida assinaturas JWT; essa responsabilidade é do backend e tem testes nos repositórios das APIs.

### CI no GitHub Actions

O workflow `.github/workflows/ci.yml` roda em pushes para `main`, branches `feature/**` e `fix/**`, além de pull requests destinados à `main`:

```text
lint → testes + cobertura → Cypress + axe → build
```

Cada job usa `needs` para só começar após o anterior passar. Uma falha interrompe as etapas seguintes. Não há conta de produção nem segredo de Keycloak no workflow. A tabela de cobertura aparece no resumo da execução. O relatório HTML pode ser baixado em **Artifacts → frontend-coverage**, inclusive quando o limite reprovar. Capturas de falhas do Cypress ficam no artefato `cypress-screenshots`. A retenção é de 14 dias.

## Acessibilidade

O botão **Acessibilidade**, disponível também antes de entrar, abre os controles próprios do BiblioGest:

- Texto padrão, ampliado (112,5%) ou maior (125%); medidas tipográficas em `rem` acompanham a escolha. O zoom do navegador continua disponível.
- Alto contraste e redução de movimento. A preferência do sistema `prefers-reduced-motion` também é respeitada.
- Restauração das preferências. Apenas essas escolhas são salvas no `localStorage`, na chave `bibliogest-accessibility`; nenhum token é salvo ali.

O link **Pular para o conteúdo** aparece ao receber foco pelo teclado. Os controles têm identificação acessível e foco visível. Todos os diálogos usam `Modal.jsx`: recebem foco ao abrir, mantêm Tab/Shift+Tab dentro da janela, tornam o fundo inativo, fecham com Escape e devolvem o foco ao acionador quando ele ainda existe. Uma operação de gravação em andamento pode impedir o fechamento por Escape para não ocultar seu resultado.

Os componentes ficam em `src/components/Accessibility.jsx` e `Modal.jsx`; estilos e preferências visuais em `src/index.css` e `src/App.css`. A suíte automatizada não substitui a revisão manual com teclado, zoom e leitor de tela. Estes controles não incluem tradução para Libras nem o serviço comercial Rybená.

## Segurança no navegador

### CSP

`security-headers.conf` define um header **Content-Security-Policy em modo de bloqueio**, carregado pelo Nginx de produção. Não é apenas `Report-Only`. A política permite somente os recursos usados pelo site:

| Recurso | Origens permitidas |
| --- | --- |
| Scripts | O próprio site e o beacon externo `static.cloudflareinsights.com` |
| Estilos | O próprio site e `fonts.googleapis.com` |
| Fontes | O próprio site e `fonts.gstatic.com` |
| Imagens | O próprio site e URLs `data:` |
| Conexões | O próprio site, `login.ksferreira.org` e o endpoint de analytics `cloudflareinsights.com` |
| Formulários | O próprio site e o login do Keycloak |
| Frames, objetos e base HTML | Bloqueados |

`default-src 'none'` bloqueia o restante. Scripts inline, `eval` e origens com curingas não são liberados. `frame-ancestors 'none'` impede incorporar o site em outros sites; `upgrade-insecure-requests` solicita recursos por HTTPS. O Keycloak usa PKCE S256 e `checkLoginIframe: false`, portanto não depende de iframe de sessão. A imagem de fundo é um arquivo do próprio projeto.

A política é enviada também em `/config.json`, `/index.html` e `/assets/`, preservando os headers mesmo nas localidades do Nginx que definem cache. Ela entra em vigor quando a imagem Docker atualizada é publicada. O Vite de desenvolvimento usa HMR e não aplica esse header de produção.

Se mudar o domínio do Keycloak, fontes ou serviços externos, revise a lista antes de publicar. Verifique **Network → documento principal → Response Headers** e o console do navegador. Não resolva violações adicionando `*`, `unsafe-inline` ou `unsafe-eval`. A CSP reduz o impacto de injeções; autorização e validação de entrada continuam obrigatórias. Referência: [CSP no MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

### Autenticação e CORS

A navegação administrativa exige `BIBLIOTECARIO`. A API é a autoridade final e valida cada operação; esconder um botão não substitui esse controle. O login usa um cliente público com PKCE, sem `client_secret`, e o token fica apenas em memória. `apiFetch` renova o token e impede enviá-lo para outra origem ou para fora do prefixo da API.

Em produção, frontend e APIs estão na mesma origem (`https://bibliogest.ksferreira.org`). Os prefixos `/acervo` e `/reservas` são roteados pelo Ingress. Por isso não é necessário abrir CORS nas APIs. No desenvolvimento normal, o proxy do Vite mantém as chamadas na origem local do frontend. O CORS do próprio Keycloak é configurado em **Web Origins** do cliente. Usar uma API, por si só, não dispensa CORS.

## Build e publicação

```bash
docker build -t bibliogest-frontend:0.1.7 .
```

O estágio final contém apenas o site compilado e a configuração do Nginx, executado como usuário 101 na porta 8080. `README.md`, `.env`, configurações locais e relatórios ficam fora do contexto Docker. O download do navegador Cypress é desativado durante a construção da imagem; os testes E2E são executados no job próprio do CI.

Em produção, `/config.json` é montado pelo ConfigMap `frontend-config` do RKE2. URLs de Keycloak e APIs são configuração pública. Senhas, tokens e chaves privadas não pertencem ao frontend. Os headers incluem ainda `nosniff`, política de referência, HSTS e bloqueio de frames. A CSP é definida no Nginx que entrega o HTML; os microsserviços retornam JSON e mantêm sua própria autorização.

## Solicitante nas reservas

O balcão e o detalhe mostram `leitorNome`, retornado pela API de Reservas, inclusive quando o bibliotecário está vendo a reserva de outra pessoa. O nome do usuário logado só serve de alternativa quando o `leitorId` da reserva corresponde ao `sub` da própria sessão. O UUID do usuário não é mostrado como nome nem como campo de identificação na tela.

Para registros antigos sem nome, aparece **Nome não informado**, sem inventar a identidade ou substituir pelo nome do bibliotecário. A API grava o nome vindo do token validado no momento da solicitação. O ID continua no contrato da API e nas verificações de propriedade; não é segredo nem substitui autorização. Os nomes são renderizados como texto pelo React.
