# BiblioGest — Frontend e API de desenvolvimento

Frontend React/Vite para leitores e bibliotecários. O repositório também contém uma API Node de desenvolvimento, protegida pelos tokens do Keycloak local. Ela persiste o catálogo físico e as reservas em `server/data/db.json` e publica alterações por Server-Sent Events (SSE).

## Iniciar localmente

Pré-requisitos: Node.js 24+, npm e Docker Desktop.

No Windows, o Docker Desktop pode exigir WSL 2 e uma reinicialização após a primeira instalação.

1. Inicie o Keycloak. O realm `bibliogest`, cliente público com PKCE e contas de demonstração são importados automaticamente:

   ```bash
   docker compose up -d keycloak
   ```

2. Em um terminal, inicie a API:

   ```bash
   npm run api
   ```

3. Em outro terminal, instale as dependências e inicie o React:

   ```bash
   npm ci
   npm run dev
   ```

   Abra `http://localhost:5173`.

### Contas locais de demonstração

| Papel | Usuário | Senha |
|---|---|---|
| Leitor | `leitor` | `leitor123` |
| Bibliotecário | `bibliotecario` | `biblio123` |

Essas credenciais são somente para desenvolvimento local. Não as reutilize em produção. O usuário bibliotecário tem os papéis `LEITOR` e `BIBLIOTECARIO`.

## Funcionalidades conectadas

- Login Keycloak com Authorization Code + PKCE, papéis de realm e renovação de token.
- Catálogo local e busca bibliográfica sob demanda no Open Library; pesquisa por título, autor e filtro de gênero.
- Detalhe de obra com descrição, ano, número de edições, capa e disponibilidade do acervo local.
- Reserva persistida, consulta das próprias reservas e confirmação da retirada pela conta bibliotecária.
- Cadastro de obras pelo bibliotecário.
- Atualizações em tempo real via SSE: deixe o leitor e o balcão abertos em navegadores/perfis diferentes para ver a reserva aparecer no balcão.
- Cada usuário recebe um ID acadêmico `ACA-ANO-...` persistido no primeiro acesso autenticado. Cada reserva recebe um tombo criptograficamente aleatório `TMB-ANO-...`, com unicidade conferida contra todos os tombos já gravados.
- Logout leva imediatamente à tela de login e encerra a sessão Keycloak.

O Open Library fornece metadados públicos, não a disponibilidade física da BiblioGest. Resultados externos aparecem como referência e não podem ser reservados até serem cadastrados no acervo local. A API pública é voltada à descoberta feita por pessoas, recomenda cache e identificação por `User-Agent`, e não deve ser usada como base de dados de alto tráfego; este projeto consulta sob demanda, limita o ritmo e mantém um cache em memória de 15 minutos. Configure `OPENLIBRARY_CONTACT` com um e-mail de contato ao iniciar a API se for usar a busca regularmente.

O banco JSON é apenas uma solução local para demonstração e integração de telas. Para publicar o produto, substitua-o pela API/dados oficiais da equipe e mantenha autorização por papel no servidor. O frontend conserva `public/config.json` para a configuração do ambiente implantado; `public/config.dev.json` é usada somente pelo Vite em desenvolvimento.

## Endpoints da API local

- `GET /api/books?q=...` — acervo local e busca Open Library quando há consulta.
- `GET /api/books/details?key=/works/OL...W` — metadados detalhados.
- `POST /api/books` — cria obra (papel `BIBLIOTECARIO`).
- `GET /api/reservations` — reservas próprias do leitor ou todas para bibliotecário.
- `POST /api/reservations` — cria reserva para um exemplar local disponível.
- `PATCH /api/reservations/:id` — confirma retirada/cancelamento (papel `BIBLIOTECARIO`).
- `GET /api/events` — atualizações SSE autenticadas.

Antes de enviar alterações, execute `npm test`, `npm run lint` e `npm run build`. O CI executa os testes e só então libera o job de build; os testes usam o test runner nativo do Node e não acrescentam dependências ao React.
