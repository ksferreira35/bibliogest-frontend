export const reservationPageSize = 20

export function attachBooks(reservations, books, user) {
  const byId = new Map(books.map((book) => [book.id, book]))
  return reservations.map((reservation) => ({
    ...reservation,
    obra: byId.get(reservation.obraId),
    leitorNome: reservation.leitorId === user.subject ? user.name : undefined,
  }))
}

export function emptyReservationView() {
  return { items: [], page: 0, hasNext: false }
}

const states = {
  AGUARDANDO_RETIRADA: { key: 'waiting', label: 'Aguardando retirada' },
  RETIRADA: { key: 'picked-up', label: 'Retirado' },
  FINALIZADA: { key: 'returned', label: 'Devolvido' },
  CANCELADA: { key: 'cancelled', label: 'Cancelado' },
}

export function normalizeReservationStatus(value) {
  return typeof value === 'string' ? value : 'DESCONHECIDO'
}

export function reservationStatusValue(reservation) {
  return reservation?.estado
}

export function reservationState(status) {
  return states[status]?.key || 'unknown'
}

export function reservationStatusLabel(status) {
  return states[status]?.label || 'Estado indisponível'
}
