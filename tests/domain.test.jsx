import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import {
  display,
  authorNames,
  matchesBook,
  coverUrl,
  showFallbackCover,
} from '../src/domain/catalog.js'
import {
  attachBooks,
  normalizeReservationStatus,
  reservationStatusValue,
} from '../src/domain/reservations.js'
import {
  ReservationDetails,
  ReservationList,
} from '../src/components/Reservations.jsx'
import CatalogPagination from '../src/components/CatalogPagination.jsx'
import Icon from '../src/components/Icon.jsx'

it('normaliza metadados incompletos sem quebrar a consulta ou a capa', () => {
  expect(display('Autor')).toBe('Autor')
  expect(display({ titulo: 'Obra' })).toBe('Obra')
  expect(display(null)).toBe('—')
  expect(authorNames({ nome: 'Autor' })).toBe('Autor')
  expect(
    matchesBook(
      { titulo: 'OBRA', autor: [], categoria: 'Mangá' },
      'obra',
      'Mangá',
    ),
  ).toBe(true)
  expect(matchesBook({}, 'isbn-ausente', 'Todas as categorias')).toBe(false)
  expect(matchesBook({ titulo: 'Obra', categoria: 'Mangá' }, '', 'Livro')).toBe(
    false,
  )
  expect(coverUrl({})).toBe('/capa-padrao.svg')
  expect(coverUrl({ id: 1, capaUrl: '/capa?v=1' }, { 1: 2 })).toBe(
    '/capa?v=1&v=2',
  )
  const img = document.createElement('img')
  img.src = '/inexistente'
  showFallbackCover({ currentTarget: img })
  showFallbackCover({ currentTarget: img })
  expect(img.getAttribute('src')).toBe('/capa-padrao.svg')
  expect(normalizeReservationStatus(null)).toBe('DESCONHECIDO')
  expect(reservationStatusValue(null)).toBeUndefined()
  expect(
    attachBooks([{ obraId: 'x', leitorId: 'other' }], [], { subject: 'me' })[0]
      .leitorNome,
  ).toBeUndefined()
})
it('mostra dados ausentes e datas inválidas sem esconder o registro de uma reserva', async () => {
  const close = vi.fn()
  render(
    <ReservationDetails
      reservation={{
        reservaId: 'r',
        leitorId: 'other',
        criadaEm: 'inválida',
        retiradaEm: '2026-11-01',
        finalizadaEm: null,
      }}
      onClose={close}
    />,
  )
  expect(screen.getByText('inválida')).toBeTruthy()
  expect(screen.getByText('Leitor other')).toBeTruthy()
  expect(screen.getByText('Não informada pela API')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(close).toHaveBeenCalledOnce()
})
it('lista reserva sem metadados e permite cancelar e abrir o registro correto', async () => {
  const cancel = vi.fn(),
    open = vi.fn()
  render(
    <ReservationList
      reservations={[{ id: 'r', obraId: 'x', estado: 'AGUARDANDO_RETIRADA' }]}
      onCancel={cancel}
      onOpen={open}
    />,
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Cancelar reserva' }),
  )
  await userEvent.click(screen.getByRole('button', { name: /Detalhes/ }))
  expect(cancel).toHaveBeenCalledWith('r')
  expect(open).toHaveBeenCalledWith('r')
})
it('retrocede uma página e não depende de uma fonte externa para os ícones', async () => {
  const change = vi.fn()
  render(
    <>
      <CatalogPagination
        info={{ pagina: 1, totalPaginas: 2, totalElementos: 20 }}
        size={12}
        onChange={change}
      />
      <Icon>inexistente</Icon>
    </>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
  expect(change).toHaveBeenCalledWith(0)
})
