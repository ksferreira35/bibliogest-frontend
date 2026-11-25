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
