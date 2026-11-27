# Contexto técnico — frontend-acessibilidade

Trechos temáticos do README da main. Confira o código e o README vigente se o contrato tiver mudado.

## Acessibilidade

O botão **Acessibilidade**, disponível também antes de entrar, abre os controles próprios do BiblioGest:

- Texto padrão, ampliado (112,5%) ou maior (125%); medidas tipográficas em `rem` acompanham a escolha. O zoom do navegador continua disponível.
- Alto contraste e redução de movimento. A preferência do sistema `prefers-reduced-motion` também é respeitada.
- Restauração das preferências. Essas escolhas são salvas no `localStorage`, na chave `bibliogest-accessibility`; a preferência de tema usa `bibliogest-theme`. Nenhum token é salvo ali.

O link **Pular para o conteúdo** aparece ao receber foco pelo teclado. Os controles têm identificação acessível e foco visível. Todos os diálogos usam `Modal.jsx`: recebem foco ao abrir, mantêm Tab/Shift+Tab dentro da janela, tornam o fundo inativo, fecham com Escape e devolvem o foco ao acionador quando ele ainda existe. Uma operação de gravação em andamento pode impedir o fechamento por Escape para não ocultar seu resultado.

Os componentes ficam em `src/components/Accessibility.jsx` e `Modal.jsx`; estilos e preferências visuais em `src/index.css` e `src/App.css`. A suíte automatizada não substitui a revisão manual com teclado, zoom e leitor de tela. Estes controles não incluem tradução para Libras nem o serviço comercial Rybená.

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
