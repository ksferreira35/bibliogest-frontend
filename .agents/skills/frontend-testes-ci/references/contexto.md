# Contexto técnico — frontend-testes-ci

Trechos temáticos do README da main. Confira o código e o README vigente se o contrato tiver mudado.

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
