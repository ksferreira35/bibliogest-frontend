import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import BookForm from '../src/components/BookForm.jsx'
import { book } from './fixtures.js'

function open(current) {
  const onSubmit = vi.fn()
  render(
    <BookForm
      book={current}
      categories={[book.categoria]}
      authors={book.autor}
      busy={false}
      onClose={vi.fn()}
      onCreateSupport={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  return onSubmit
}

it('carrega e atualiza a descrição existente preservando parágrafos', async () => {
  const submit = open({ ...book, descricao: 'Descrição antiga' })
  const input = screen.getByLabelText('Descrição (opcional)')
  expect(input.value).toBe('Descrição antiga')
  expect(input.maxLength).toBe(5000)
  await userEvent.clear(input)
  await userEvent.type(
    input,
    'Primeiro parágrafo.{enter}{enter}Segundo parágrafo.',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Salvar alterações' }),
  )
  expect(submit.mock.calls[0][0].descricao).toBe(
    'Primeiro parágrafo.\n\nSegundo parágrafo.',
  )
})

it('permite remover a sinopse existente', async () => {
  const submit = open({ ...book, descricao: 'Descrição antiga' })
  await userEvent.clear(screen.getByLabelText('Descrição (opcional)'))
  await userEvent.click(
    screen.getByRole('button', { name: 'Salvar alterações' }),
  )
  expect(submit.mock.calls[0][0].descricao).toBeNull()
})

it('permite cadastrar obra sem descrição e mostra o limite disponível', async () => {
  const submit = open()
  await userEvent.type(screen.getByLabelText('Título'), 'Obra nova')
  await userEvent.selectOptions(
    screen.getByLabelText('Categoria'),
    book.categoria.id,
  )
  await userEvent.selectOptions(
    screen.getByRole('listbox', { name: /Autor/ }),
    'autor-1',
  )
  expect(screen.getByText('0/5000 caracteres')).toBeTruthy()
  await userEvent.click(
    screen.getByRole('button', { name: 'Salvar obra no Acervo' }),
  )
  expect(submit.mock.calls[0][0].descricao).toBeNull()
})

it('cadastra autor e categoria, seleciona os novos registros e envia os campos opcionais', async () => {
  const onCreateSupport = vi.fn(async (_service, path, nome) => ({
    id: path.endsWith('autores') ? 'novo-autor' : 'nova-categoria',
    nome,
  }))
  const submit = vi.fn()
  render(
    <BookForm
      book={book}
      categories={[book.categoria, { id: 'nova-categoria', nome: 'Nova' }]}
      authors={[...book.autor, { id: 'novo-autor', nome: 'Novo' }]}
      onClose={vi.fn()}
      onSubmit={submit}
      onCreateSupport={onCreateSupport}
    />,
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Cadastrar categoria' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar autor' }))
  expect(onCreateSupport).not.toHaveBeenCalled()
  await userEvent.type(
    screen.getByLabelText('Nome da nova categoria'),
    ' Nova ',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Cadastrar categoria' }),
  )
  await userEvent.type(screen.getByLabelText('Nome do novo autor'), ' Novo ')
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar autor' }))
  await userEvent.type(
    screen.getByLabelText('ISBN (opcional)'),
    '9780000000001',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Salvar alterações' }),
  )
  expect(submit.mock.calls[0][0]).toMatchObject({
    categoriaId: 'nova-categoria',
    autorIds: ['autor-1', 'novo-autor'],
    isbn: '9780000000001',
  })
})
it('mantém o formulário aberto e informa erros ao criar autor ou categoria', async () => {
  const create = vi.fn().mockRejectedValue(new Error('Registro duplicado'))
  render(
    <BookForm
      categories={[]}
      authors={[]}
      onClose={vi.fn()}
      onCreateSupport={create}
    />,
  )
  await userEvent.type(
    screen.getByLabelText('Nome da nova categoria'),
    'Categoria',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Cadastrar categoria' }),
  )
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Registro duplicado',
  )
  await userEvent.type(screen.getByLabelText('Nome do novo autor'), 'Autor')
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar autor' }))
  expect(create).toHaveBeenCalledTimes(2)
})
