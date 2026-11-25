import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.jsx'
import { apiFetch } from '../src/auth.js'
import { account, book, deferred, json, reservation } from './fixtures.js'

vi.mock('../src/auth.js', async (original) => ({
  ...(await original()),
  apiFetch: vi.fn(),
  appRedirectUri: () => 'http://localhost:3000/',
  logout: vi.fn().mockResolvedValue(undefined),
}))

let mine
let all
let books

beforeEach(() => {
  mine = [reservation()]
  all = mine
  books = [structuredClone(book)]
  apiFetch.mockImplementation(async (service, path, options = {}) => {
    const url = new URL(path, 'https://test.invalid')
    if (service === 'acervo' && url.pathname === '/v1/obras') {
      const query = (url.searchParams.get('busca') || '').toLowerCase()
      const category = url.searchParams.get('categoriaId')
      const filtered = books.filter(
        (item) =>
          `${item.titulo} ${item.autor.map((a) => a.nome).join(' ')} ${item.isbn || ''}`
            .toLowerCase()
            .includes(query) &&
          (!category || item.categoria.id === category),
      )
      const page = Number(url.searchParams.get('pagina') || 0)
      const size = Number(url.searchParams.get('tamanho') || 20)
      return json({
        content: filtered.slice(page * size, (page + 1) * size),
        pagina: page,
        tamanho: size,
        totalElementos: filtered.length,
        totalPaginas: Math.ceil(filtered.length / size),
      })
    }
    if (url.pathname === '/v1/obras/resumo')
      return json(
        books.filter((item) =>
          url.searchParams.get('ids').split(',').includes(item.id),
        ),
      )
    if (
      url.pathname.startsWith('/v1/obras/') &&
      options.method === 'PUT' &&
      !path.endsWith('/capa')
    ) {
      const item = books.find((item) => url.pathname.endsWith(item.id))
      const payload = JSON.parse(options.body)
      Object.assign(item, {
        titulo: payload.titulo,
        volume: payload.volume,
        isbn: payload.isbn,
        descricao: payload.descricao,
        autor: payload.autorIds.map((id) => ({
          id,
          nome: id === 'autor-correto' ? 'Jung Ji-hoon' : 'Sui Ishida',
        })),
      })
      return json(item)
    }
    if (url.pathname.startsWith('/v1/obras/') && options.method === 'DELETE') {
      books = books.filter((item) => !url.pathname.endsWith(item.id))
      return new Response(null, { status: 204 })
    }
    if (path === '/v1/categorias') return json([book.categoria])
    if (path === '/v1/autores')
      return json([
        ...book.autor,
        { id: 'autor-correto', nome: 'Jung Ji-hoon' },
      ])
    if (path.endsWith('/capa')) return json(book)
    if (path.endsWith('/disponibilidade'))
      return json({
        obraId: book.id,
        exemplares: [
          { exemplarId: reservation().exemplarId, disponivel: true },
        ],
      })
    if (path.endsWith('/cancelar')) return json(reservation(1, 'CANCELADA'))
    if (url.pathname === '/v1/reservas' && options.method === 'POST')
      return json(reservation(), 201)
    const action = url.pathname.match(
      /^\/v1\/reservas\/([^/]+)\/(retirada|devolucao)$/,
    )
    if (action && options.method === 'POST') {
      const item = all.find((current) => current.id === action[1])
      item.estado = action[2] === 'retirada' ? 'RETIRADA' : 'FINALIZADA'
      return json(item)
    }
    if (
      url.pathname === '/v1/reservas' ||
      url.pathname === '/v1/reservas/minhas'
    ) {
      const page = Number(url.searchParams.get('pagina'))
      const size = Number(url.searchParams.get('tamanho'))
      const items = url.pathname.endsWith('/minhas') ? mine : all
      return json(items.slice(page * size, (page + 1) * size))
    }
    if (url.pathname.startsWith('/v1/reservas/'))
      return json(
        all.find((item) => url.pathname.endsWith(item.id)) || reservation(),
      )
    throw new Error(`Requisição inesperada: ${service} ${path}`)
  })
})

function start(roles) {
  const keycloak = account(roles)
  render(<App auth={{ available: true, keycloak }} />)
  return keycloak
}

async function catalogReady() {
  await screen.findByRole('heading', { name: 'Tokyo Ghoul', exact: true })
}

describe('acesso por perfil', () => {
  it('leitor consulta o catálogo sem renderizar painéis ou ações administrativas', async () => {
    start(['LEITOR'])
    await catalogReady()
    expect(
      screen.queryByRole('button', { name: /Gestão do acervo/ }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /Balcão/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cadastrar obra/ })).toBeNull()
    expect(screen.queryByText('Enviar capa')).toBeNull()
    expect(
      apiFetch.mock.calls.every(
        ([service, path, options]) =>
          service === 'acervo' &&
          (path.startsWith('/v1/obras?') || path === '/v1/categorias') &&
          !options?.method,
      ),
    ).toBe(true)
  })

  it.each([
    { roles: [] },
    { roles: ['bibliotecario'] },
    { roles: ['LIBRARIAN'] },
  ])('bloqueia perfis que a API não reconhece: $roles', async ({ roles }) => {
    start(roles)
    expect(
      screen.getByRole('heading', { name: 'Acesso não autorizado' }),
    ).toBeTruthy()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('bibliotecário consegue abrir gestão e balcão', async () => {
    start(['LEITOR', 'BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    expect(screen.getByRole('button', { name: /Cadastrar obra/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    expect(
      await screen.findByRole('button', { name: 'Registrar retirada' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Registrar devolução' }),
    ).toBeNull()
  })

  it('remove painel e formulário abertos quando o token perde a role de bibliotecário', async () => {
    const keycloak = start(['LEITOR', 'BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Cadastrar obra/ }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Cadastrar obra' }),
    ).toBeTruthy()
    act(() => {
      keycloak.roles = ['LEITOR']
      keycloak.onAuthRefreshSuccess()
    })
    await catalogReady()
    expect(screen.queryByRole('heading', { name: 'Cadastrar obra' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Gestão do acervo/ }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /Balcão/ })).toBeNull()
  })

  it('bibliotecário sem LEITOR não recebe permissão de criar reserva própria', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Consultar disponibilidade/ }),
    )
    const button = await screen.findByRole('button', {
      name: 'Reservar',
      exact: true,
    })
    expect(button.disabled).toBe(true)
  })

  it('volta para a tela de entrada quando a sessão é encerrada', async () => {
    const keycloak = start(['BIBLIOTECARIO'])
    await catalogReady()
    act(() => keycloak.clearToken())
    expect(
      screen.getByRole('button', { name: /Entrar com a conta institucional/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Balcão/ })).toBeNull()
  })
})

describe('catálogo e reservas', () => {
  it('encontra a obra por autor retornado como lista pelo Acervo', async () => {
    start(['LEITOR'])
    await catalogReady()
    await userEvent.type(
      screen.getByPlaceholderText('Busque por título, autor ou ISBN'),
      'Sui Ishida',
    )
    expect(screen.getByRole('heading', { name: 'Tokyo Ghoul' })).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver detalhes de Tokyo Ghoul' }),
    )
    expect(
      within(screen.getByRole('dialog')).getByText('Sui Ishida · Mangá'),
    ).toBeTruthy()
  })

  it('mostra o título do catálogo e o nome do próprio leitor nos detalhes da reserva', async () => {
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Minhas reservas/ }),
    )
    await screen.findByRole('button', { name: /Cancelar reserva/ })
    expect(screen.getByRole('heading', { name: 'Tokyo Ghoul' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Detalhes/ }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByText('Tokyo Ghoul')).toBeTruthy()
    expect(modal.getByText('Kaiky Ferreira')).toBeTruthy()
    expect(modal.queryByText('Não informada pela API')).toBeNull()
  })

  it('exibe a reserva 21 no balcão com navegação entre páginas, sem consultas individuais', async () => {
    all = Array.from({ length: 21 }, (_, index) =>
      reservation(
        index + 1,
        index === 20 ? 'AGUARDANDO_RETIRADA' : 'FINALIZADA',
      ),
    )
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    await screen.findByText('Página 1 · 20 reservas nesta página')
    expect(
      screen.queryByRole('button', { name: 'Registrar retirada' }),
    ).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Próxima página' }),
    )
    expect(
      await screen.findByText('Página 2 · 1 reservas nesta página'),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Registrar retirada' }),
    ).toBeTruthy()
    expect(apiFetch).toHaveBeenCalledWith(
      'reservas',
      '/v1/reservas?pagina=1&tamanho=20',
      undefined,
    )
    expect(
      apiFetch.mock.calls.some(([, path]) =>
        /^\/v1\/reservas\/[0-9]/.test(path),
      ),
    ).toBe(false)
    await userEvent.click(
      screen.getByRole('button', { name: 'Página anterior' }),
    )
    expect(
      await screen.findByText('Página 1 · 20 reservas nesta página'),
    ).toBeTruthy()
  })

  it('não troca Minhas reservas por uma resposta atrasada do balcão', async () => {
    start(['LEITOR', 'BIBLIOTECARIO'])
    await catalogReady()
    const pending = deferred()
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) =>
      path.startsWith('/v1/reservas?')
        ? pending.promise
        : handler(service, path, options),
    )
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    await userEvent.click(
      screen.getByRole('button', { name: /Minhas reservas/ }),
    )
    await screen.findByRole('button', { name: /Cancelar reserva/ })
    await act(async () =>
      pending.resolve(json([{ ...reservation(90), leitorId: 'outro-leitor' }])),
    )
    expect(screen.queryByText(`RESERVA #${reservation(90).id}`)).toBeNull()
    expect(screen.getByText(`RESERVA #${reservation().id}`)).toBeTruthy()
  })

  it('renova a URL da imagem depois de substituir uma capa', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    const image = screen.getByRole('img', { name: 'Capa de Tokyo Ghoul' })
    const previous = image.getAttribute('src')
    const file = new File(['imagem-de-teste'], 'capa.png', {
      type: 'image/png',
    })
    await userEvent.upload(screen.getByLabelText('Enviar capa'), file)
    await waitFor(() => expect(image.getAttribute('src')).not.toBe(previous))
    expect(image.getAttribute('src')).toMatch(/\.jpg\?v=\d+/)
  })

  it('descarta a disponibilidade atrasada de uma obra cujo modal foi fechado', async () => {
    const secondBook = { ...book, id: 'obra-2', titulo: 'Segunda obra' }
    books = [book, secondBook]
    start(['LEITOR'])
    await catalogReady()
    const pending = deferred()
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) =>
      path.includes(`${book.id}/disponibilidade`)
        ? pending.promise
        : handler(service, path, options),
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: /Consultar disponibilidade/ })[0],
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Fechar', exact: true }),
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: /Consultar disponibilidade/ })[1],
    )
    await screen.findByRole('button', { name: 'Reservar', exact: true })
    await act(async () =>
      pending.resolve(
        json({
          exemplares: [{ exemplarId: 'exemplar-atrasado', disponivel: true }],
        }),
      ),
    )
    expect(
      within(screen.getByRole('dialog')).queryByText(/exemplar-atrasado/),
    ).toBeNull()
  })

  it('leitor cria reserva passando somente a obra e o exemplar, sem escolher outra identidade', async () => {
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Consultar disponibilidade/ }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reservar', exact: true }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const operation = apiFetch.mock.calls.find(
      ([, path, options]) =>
        path === '/v1/reservas' && options?.method === 'POST',
    )
    expect(JSON.parse(operation[2].body)).toEqual({
      obraId: book.id,
      exemplarId: reservation().exemplarId,
    })
    expect(apiFetch).toHaveBeenCalledWith(
      'reservas',
      '/v1/reservas/minhas?pagina=0&tamanho=20',
      undefined,
    )
  })

  it('bibliotecário registra retirada e depois devolução pelos endpoints corretos', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Registrar retirada',
        exact: true,
      }),
    )
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Registrar devolução',
        exact: true,
      }),
    )
    await screen.findByText('Devolvido')
    expect(apiFetch).toHaveBeenCalledWith(
      'reservas',
      `/v1/reservas/${reservation().id}/retirada`,
      { method: 'POST' },
    )
    expect(apiFetch).toHaveBeenCalledWith(
      'reservas',
      `/v1/reservas/${reservation().id}/devolucao`,
      { method: 'POST' },
    )
    expect(
      screen.queryByRole('button', { name: 'Registrar devolução' }),
    ).toBeNull()
  })

  it('respeita um 403 do backend sem anunciar sucesso na operação administrativa', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) =>
      path.endsWith('/retirada')
        ? json({ detail: 'Acesso negado pela API.' }, 403)
        : handler(service, path, options),
    )
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Registrar retirada',
        exact: true,
      }),
    )
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain(
      'Acesso negado pela API.',
    )
    expect(screen.queryByText('Retirada registrada.')).toBeNull()
  })

  it('diferencia falha da API de catálogo vazio e permite tentar novamente', async () => {
    const handler = apiFetch.getMockImplementation()
    let failed = false
    apiFetch.mockImplementation((service, path, options) => {
      if (!failed && path.startsWith('/v1/obras?')) {
        failed = true
        return Promise.reject(new Error('Acervo indisponível.'))
      }
      return handler(service, path, options)
    })
    start(['LEITOR'])
    await screen.findByRole('heading', {
      name: 'Não foi possível carregar o catálogo',
    })
    expect(
      screen.queryByRole('heading', { name: 'Nenhuma obra cadastrada' }),
    ).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    )
    await catalogReady()
  })

  it('trata catálogo vazio como vazio, em vez de manter carregamento infinito', async () => {
    books = []
    start(['LEITOR'])
    expect(
      await screen.findByRole('heading', { name: 'Nenhuma obra cadastrada' }),
    ).toBeTruthy()
    expect(screen.queryByText('O catálogo está carregando')).toBeNull()
  })

  it('não permite devolução de estado desconhecido', async () => {
    all = [reservation(1, 'ESTADO_INVALIDO')]
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(screen.getByRole('button', { name: /Balcão/ }))
    await screen.findByText('Estado indisponível')
    expect(
      screen.queryByRole('button', { name: 'Registrar retirada' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Registrar devolução' }),
    ).toBeNull()
  })
})

describe('edição, exclusão e paginação de obras', () => {
  it('edita autor e dados opcionais com PUT preservando o ID', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Editar', exact: true }),
    )
    const form = within(await screen.findByRole('dialog'))
    expect(form.getByLabelText('Título').value).toBe('Tokyo Ghoul')
    await userEvent.deselectOptions(
      form.getByRole('listbox', { name: /Autor/ }),
      'autor-1',
    )
    await userEvent.selectOptions(
      form.getByRole('listbox', { name: /Autor/ }),
      'autor-correto',
    )
    await userEvent.clear(form.getByLabelText('Volume (opcional)'))
    await userEvent.click(
      form.getByRole('button', { name: 'Salvar alterações' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Jung Ji-hoon · Mangá')).toBeTruthy()
    const [, path, options] = apiFetch.mock.calls.find(
      ([, , options]) => options?.method === 'PUT',
    )
    expect(path).toBe(`/v1/obras/${book.id}`)
    expect(JSON.parse(options.body)).toEqual({
      titulo: book.titulo,
      categoriaId: book.categoria.id,
      autorIds: ['autor-correto'],
      volume: null,
      isbn: null,
      descricao: null,
    })
  })

  it('só exclui após confirmação explícita e atualiza o catálogo', async () => {
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir', exact: true }),
    )
    expect(
      apiFetch.mock.calls.some(([, , options]) => options?.method === 'DELETE'),
    ).toBe(false)
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancelar', exact: true }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir', exact: true }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    )
    await screen.findByText('Obra excluída do Acervo.')
    expect(screen.queryByText('Tokyo Ghoul')).toBeNull()
    expect(apiFetch).toHaveBeenCalledWith('acervo', `/v1/obras/${book.id}`, {
      method: 'DELETE',
    })
  })

  it('explica o bloqueio de exclusão sem ocultar uma obra com exemplares', async () => {
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) =>
      options?.method === 'DELETE'
        ? json(
            {
              detail:
                'Esta obra possui exemplares vinculados e não pode ser excluída.',
            },
            409,
          )
        : handler(service, path, options),
    )
    start(['BIBLIOTECARIO'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Gestão do acervo/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir', exact: true }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    )
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveProperty(
      'textContent',
      'Esta obra possui exemplares vinculados e não pode ser excluída.',
    )
    expect(screen.queryByText('Obra excluída do Acervo.')).toBeNull()
  })

  it('leitor não recebe comandos de edição e exclusão', async () => {
    start(['LEITOR'])
    await catalogReady()
    expect(
      screen.queryByRole('button', { name: 'Editar', exact: true }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Excluir', exact: true }),
    ).toBeNull()
  })

  it('carrega outra página da API e reinicia a página ao buscar por autor', async () => {
    books = Array.from({ length: 13 }, (_, index) => ({
      ...structuredClone(book),
      id: `obra-${index}`,
      titulo: index === 0 ? 'Tokyo Ghoul' : `Obra ${index}`,
      autor: [
        {
          id: `autor-${index}`,
          nome: index === 12 ? 'Jung Ji-hoon' : 'Sui Ishida',
        },
      ],
    }))
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: 'Próxima página' }),
    )
    await screen.findByText('Página 2 de 2 · 13 obras')
    expect(screen.getByRole('heading', { name: 'Obra 12' })).toBeTruthy()
    await userEvent.type(
      screen.getByPlaceholderText('Busque por título, autor ou ISBN'),
      'Jung',
    )
    await screen.findByText('Página 1 de 1 · 1 obras')
    expect(
      apiFetch.mock.calls.some(
        ([, path]) => path.includes('pagina=0') && path.includes('busca=Jung'),
      ),
    ).toBe(true)
  })

  it('filtra categoria no servidor e muda o tamanho da página', async () => {
    start(['LEITOR'])
    await catalogReady()
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Filtrar por categoria' }),
      book.categoria.id,
    )
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(([, path]) =>
          path.includes('categoriaId=categoria-1'),
        ),
      ).toBe(true),
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Obras por página' }),
      '24',
    )
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(
          ([, path]) =>
            path.includes('tamanho=24') && path.includes('pagina=0'),
        ),
      ).toBe(true),
    )
  })

  it('resolve títulos de reservas fora da página por uma única consulta em lote', async () => {
    books = Array.from({ length: 13 }, (_, index) => ({
      ...structuredClone(book),
      id: index === 0 ? book.id : `obra-${index}`,
      titulo: index === 0 ? 'Tokyo Ghoul' : `Obra ${index}`,
    }))
    mine = [{ ...reservation(), obraId: 'obra-12' }]
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Minhas reservas/ }),
    )
    await screen.findByRole('heading', { name: 'Obra 12' })
    expect(apiFetch).toHaveBeenCalledWith(
      'acervo',
      '/v1/obras/resumo?ids=obra-12',
      undefined,
    )
  })

  it('ignora resposta antiga de uma busca enquanto o usuário filtra outra', async () => {
    start(['LEITOR'])
    await catalogReady()
    const pending = deferred()
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) =>
      path.includes('busca=antiga')
        ? pending.promise
        : handler(service, path, options),
    )
    const search = screen.getByPlaceholderText(
      'Busque por título, autor ou ISBN',
    )
    await userEvent.type(search, 'antiga')
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(([, path]) => path.includes('busca=antiga')),
      ).toBe(true),
    )
    await userEvent.clear(search)
    await userEvent.type(search, 'Tokyo')
    await waitFor(() =>
      expect(
        apiFetch.mock.calls.some(([, path]) => path.includes('busca=Tokyo')),
      ).toBe(true),
    )
    await screen.findByRole('heading', { name: 'Tokyo Ghoul' })
    await act(async () =>
      pending.resolve(
        json({ content: [], pagina: 0, totalElementos: 0, totalPaginas: 0 }),
      ),
    )
    expect(screen.getByRole('heading', { name: 'Tokyo Ghoul' })).toBeTruthy()
  })
})

describe('sinopse da obra', () => {
  it('exibe a descrição para o leitor como texto, sem interpretar HTML', async () => {
    books[0].descricao = 'Primeiro parágrafo.\n\n<img src=x onerror=alert(1)>'
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver detalhes de Tokyo Ghoul' }),
    )
    const section = within(screen.getByRole('dialog')).getByRole('region', {
      name: 'Sinopse',
    })
    expect(section.textContent).toContain('Primeiro parágrafo.')
    expect(section.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(section.querySelector('img')).toBeNull()
  })

  it('explica quando a sinopse ainda não foi cadastrada', async () => {
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver detalhes de Tokyo Ghoul' }),
    )
    expect(
      within(screen.getByRole('dialog')).getByText(
        'Sinopse ainda não cadastrada.',
      ),
    ).toBeTruthy()
  })
})

it('bibliotecário cadastra exemplar dentro da obra selecionada e fecha o diálogo pelo teclado', async () => {
  const handler = apiFetch.getMockImplementation()
  const copies = []
  apiFetch.mockImplementation((service, path, options) => {
    if (path.endsWith('/exemplares')) {
      if (options?.method === 'POST')
        copies.push({
          id: 'copy-1',
          codigoTombo: JSON.parse(options.body).codigoTombo,
        })
      return json([...copies])
    }
    return handler(service, path, options)
  })
  start(['BIBLIOTECARIO'])
  await catalogReady()
  await userEvent.click(
    screen.getByRole('button', { name: /Gestão do acervo/ }),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Exemplares', exact: true }),
  )
  await screen.findByRole('dialog')
  await userEvent.type(screen.getByLabelText('Código do tombo'), 'TESTE-001')
  await userEvent.click(
    screen.getByRole('button', { name: 'Adicionar exemplar' }),
  )
  await screen.findByText(/TESTE-001/)
  expect(apiFetch).toHaveBeenCalledWith(
    'acervo',
    `/v1/obras/${book.id}/exemplares`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ codigoTombo: 'TESTE-001' }),
    }),
  )
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
})
it.each([[], null])(
  'trata disponibilidade vazia ou inválida sem liberar reserva: %s',
  async (value) => {
    const handler = apiFetch.getMockImplementation()
    apiFetch.mockImplementation((service, path, options) => {
      if (path.endsWith('/disponibilidade')) return json({ exemplares: value })
      if (path.endsWith('/exemplares')) return json([])
      return handler(service, path, options)
    })
    start(['LEITOR'])
    await catalogReady()
    await userEvent.click(
      screen.getByRole('button', { name: /Consultar disponibilidade/ }),
    )
    if (value)
      await screen.findByText(
        'Esta obra não tem exemplares cadastrados no Acervo.',
      )
    else
      await screen.findByText(
        'A resposta da API de Reservas não contém a lista de exemplares disponíveis.',
      )
    expect(
      screen.queryByRole('button', { name: 'Reservar', exact: true }),
    ).toBeNull()
  },
)
