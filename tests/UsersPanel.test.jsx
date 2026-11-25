import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import UsersPanel from '../src/components/UsersPanel.jsx'
import { apiFetch } from '../src/auth.js'
import { json } from './fixtures.js'
vi.mock('../src/auth.js', () => ({ apiFetch: vi.fn() }))
const user = {
  id: 'other',
  nome: 'Pessoa',
  sobrenome: 'Teste',
  email: 'test@example.test',
  ativo: true,
  bibliotecario: false,
  protegido: false,
}
let rows, selected
beforeEach(() => {
  rows = [{ ...user }]
  selected = { ...user }
  apiFetch.mockImplementation(async (_service, path, options) => {
    if (options?.method)
      return options.method === 'POST' && path === '/v1/usuarios'
        ? json(user, 201)
        : new Response(null, { status: 204 })
    if (path.startsWith('/v1/auditoria'))
      return json([
        {
          id: 'a',
          acao: 'ATIVAR',
          estado: 'SUCESSO',
          criada_em: '2026-11-25T12:00:00Z',
          ator: 'admin',
          alvo: 'other',
        },
      ])
    return json(path.startsWith('/v1/usuarios?') ? rows : selected)
  })
})
async function idle() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Criar conta' }).disabled).toBe(
      false,
    ),
  )
}
async function start() {
  render(<UsersPanel subject="admin" />)
  await screen.findByText('test@example.test')
}
it('busca, seleciona usuário e exige confirmação para promover', async () => {
  await start()
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Buscar usuários' }),
    'Pessoa',
  )
  await waitFor(() =>
    expect(
      apiFetch.mock.calls.some(([, p]) => p.includes('busca=Pessoa')),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Promover a bibliotecário' }),
  )
  expect(apiFetch.mock.calls.some(([, , o]) => o?.method === 'PUT')).toBe(false)
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirmar alteração' }),
  )
  await screen.findByRole('status')
  await idle()
  expect(apiFetch).toHaveBeenCalledWith(
    'usuarios',
    '/v1/usuarios/other/bibliotecario',
    expect.objectContaining({ method: 'PUT', body: '{"valor":true}' }),
  )
})
it.each([
  'Desativar conta',
  'Encerrar sessões',
  'Remover função de bibliotecário',
])('executa ação confirmada: %s', async (action) => {
  selected.bibliotecario = true
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  await userEvent.click(await screen.findByRole('button', { name: action }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: action }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirmar alteração' }),
  )
  await screen.findByRole('status')
  await idle()
})
it('ativa conta desativada e fecha painel pelo botão', async () => {
  selected.ativo = false
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Ativar conta' }),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Confirmar alteração' }),
  )
  await screen.findByRole('status')
  await idle()
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Fechar conta' }),
  )
})
it('não oferece alterações para conta protegida', async () => {
  selected.protegido = true
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  await screen.findByText('Esta conta é gerenciada diretamente no Keycloak.')
  expect(
    screen.queryByRole('button', { name: 'Promover a bibliotecário' }),
  ).toBeNull()
  await userEvent.keyboard('{Escape}')
})
it('cria leitor com senha temporária e limpa o formulário', async () => {
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  await userEvent.type(screen.getByLabelText('Nome'), 'Nova')
  await userEvent.type(screen.getByLabelText('Sobrenome'), 'Pessoa')
  await userEvent.type(screen.getByLabelText('E-mail'), 'new@example.test')
  await userEvent.type(
    screen.getByLabelText('Senha temporária'),
    'temporary-test-only',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))
  await screen.findByRole('status')
  await idle()
  expect(screen.queryByLabelText('Senha temporária')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  expect(screen.getByLabelText('Senha temporária').value).toBe('')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
})
it('exibe o histórico e fecha o diálogo', async () => {
  await start()
  await userEvent.click(
    screen.getByRole('button', { name: 'Histórico de ações' }),
  )
  expect(await screen.findByText('ATIVAR · SUCESSO')).toBeTruthy()
  await userEvent.click(
    screen.getByRole('button', { name: 'Fechar histórico' }),
  )
})
it('informa erros sem anunciar sucesso', async () => {
  await start()
  apiFetch.mockResolvedValue(json({ detail: 'Operação recusada.' }, 403))
  await userEvent.click(screen.getByRole('button', { name: 'Gerenciar conta' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Operação recusada.',
  )
  expect(screen.queryByRole('status')).toBeNull()
})
it('pagina os resultados e mostra uma busca vazia', async () => {
  rows = Array.from({ length: 20 }, (_, i) => ({
    ...user,
    id: String(i),
    email: `user${i}@example.test`,
  }))
  render(<UsersPanel subject="admin" />)
  await screen.findByText('user0@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await screen.findByText('Página 2')
  await idle()
  await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
  await screen.findByText('Página 1')
  rows = []
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Buscar usuários' }),
    'inexistente',
  )
  await screen.findByText('Nenhuma conta encontrada.')
})
