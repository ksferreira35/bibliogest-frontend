import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import Accessibility from '../src/components/Accessibility.jsx'
import Modal from '../src/components/Modal.jsx'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.contrast
})
it('salva somente preferências e permite restaurá-las', async () => {
  const view = render(<Accessibility />)
  await userEvent.click(screen.getByRole('button', { name: 'Acessibilidade' }))
  await userEvent.selectOptions(
    screen.getByLabelText('Tamanho do texto'),
    'extra',
  )
  await userEvent.click(screen.getByLabelText('Alto contraste'))
  await userEvent.click(screen.getByLabelText('Reduzir movimento'))
  expect(document.documentElement.dataset.textSize).toBe('extra')
  expect(document.documentElement.dataset.contrast).toBe('true')
  expect(document.documentElement.dataset.reducedMotion).toBe('true')
  await userEvent.keyboard('{Escape}')
  expect(document.activeElement.textContent).toBe('Acessibilidade')
  view.unmount()
  render(<Accessibility />)
  expect(document.documentElement.dataset.textSize).toBe('extra')
  await userEvent.click(screen.getByRole('button', { name: 'Acessibilidade' }))
  await userEvent.click(
    screen.getByRole('button', { name: 'Restaurar preferências' }),
  )
  expect(document.documentElement.dataset.contrast).toBe('false')
  await userEvent.click(
    screen.getByRole('button', { name: 'Fechar acessibilidade' }),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('tolera preferências inválidas e armazenamento indisponível', () => {
  localStorage.setItem('bibliogest-accessibility', 'invalid json')
  const view = render(<Accessibility />)
  expect(document.documentElement.dataset.textSize).toBe('normal')
  view.unmount()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  render(<Accessibility />)
  expect(screen.getByRole('button', { name: 'Acessibilidade' })).toBeTruthy()
})
it('mantém Tab no diálogo, impede foco no fundo e devolve foco ao fechar', async () => {
  const close = vi.fn()
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const view = render(
    <Modal onClose={close} aria-label="Teste">
      <button>Primeiro</button>
      <button disabled>Desativado</button>
      <button>Último</button>
    </Modal>,
  )
  expect(document.activeElement.textContent).toBe('Primeiro')
  expect(trigger.inert).toBe(true)
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
  expect(document.activeElement.textContent).toBe('Último')
  await userEvent.keyboard('{Tab}')
  expect(document.activeElement.textContent).toBe('Primeiro')
  await userEvent.keyboard('{Escape}')
  expect(close).toHaveBeenCalledOnce()
  view.unmount()
  expect(document.activeElement).toBe(trigger)
  expect(trigger.inert).toBe(false)
  trigger.remove()
})
it('diálogo sem botões continua alcançável pelo teclado', () => {
  render(
    <Modal aria-label="Carregando">
      <p>Aguarde</p>
    </Modal>,
  )
  const dialog = screen.getByRole('dialog')
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(document.activeElement).toBe(dialog)
})
