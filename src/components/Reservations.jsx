import Modal from './Modal.jsx'
import Icon from './Icon.jsx'
import {
  normalizeReservationStatus,
  reservationState,
  reservationStatusLabel,
  reservationStatusValue,
} from '../domain/reservations.js'

export function ReservationList({
  reservations,
  onCancel,
  onOpen,
  librarian,
  onPickup,
  onReturn,
  busy,
}) {
  if (!reservations.length)
    return (
      <div className="empty-state">
        <Icon>bookmark</Icon>
        <h2>Nenhuma reserva por aqui</h2>
        <p>Quando houver reservas, elas aparecerão nesta lista.</p>
      </div>
    )
  return (
    <div className="reservation-list">
      {reservations.map((item) => {
        const id = item.id
        const status = normalizeReservationStatus(reservationStatusValue(item))
        const title = item.obra?.titulo || `Obra ${item.obraId}`
        const state = reservationState(status)
        const statusLabel = reservationStatusLabel(status, state)
        const waiting = state === 'waiting'
        const exemplar = item.exemplarId
        const createdAt = item.criadaEm
        return (
          <article className="reservation-row" key={id}>
            <div className="reservation-icon">
              <Icon>menu_book</Icon>
            </div>
            <div className="reservation-main">
              <span className="eyebrow">RESERVA #{id}</span>
              <h2>{title}</h2>
              <p>
                {exemplar ? `Exemplar ${exemplar}` : 'Exemplar físico'} ·{' '}
                {formatDateTime(createdAt)}
              </p>
              {librarian && (
                <p className="reservation-requester">
                  Solicitante: {item.leitorNome || 'Nome não informado'}
                </p>
              )}
            </div>
            <span className={`status-stamp ${state}`}>{statusLabel}</span>
            <div className="row-actions">
              {librarian ? (
                <>
                  <button className="text-action" onClick={() => onOpen(id)}>
                    Detalhes <Icon>arrow_forward</Icon>
                  </button>
                  {waiting && (
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => onPickup(id)}
                    >
                      Registrar retirada
                    </button>
                  )}
                  {state === 'picked-up' && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => onReturn(id, state)}
                    >
                      Registrar devolução
                    </button>
                  )}
                </>
              ) : (
                <>
                  {waiting && (
                    <button
                      className="text-action danger-text"
                      disabled={busy}
                      onClick={() => onCancel(id)}
                    >
                      Cancelar reserva
                    </button>
                  )}
                  <button className="text-action" onClick={() => onOpen(id)}>
                    Detalhes <Icon>arrow_forward</Icon>
                  </button>
                </>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return 'Não informado pela API'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const dateOnly =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    ...(dateOnly ? {} : { timeStyle: 'short' }),
  }).format(date)
}

export function ReservationDetails({ reservation, onClose }) {
  const name = reservation.leitorNome
  const requestedAt = reservation.criadaEm
  const pickedUpAt = reservation.retiradaEm
  const returnedAt = reservation.finalizadaEm
  const status = normalizeReservationStatus(reservationStatusValue(reservation))
  const state = reservationState(status)
  const copy = reservation.exemplarId
  const title = reservation.obra?.titulo
  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Modal
        className="modal"
        onClose={onClose}
        aria-labelledby="reservation-details-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <span className="eyebrow">CIRCULAÇÃO · REGISTRO DA RESERVA</span>
        <h2 id="reservation-details-title">Detalhes da reserva</h2>
        <dl className="book-details">
          <dt>Reserva</dt>
          <dd>{reservation.id || reservation.reservaId || '—'}</dd>
          <dt>Obra</dt>
          <dd>{title || 'Não informada pela API'}</dd>
          <dt>Solicitante</dt>
          <dd>{name || 'Nome não informado'}</dd>
          <dt>Solicitada em</dt>
          <dd>{formatDateTime(requestedAt)}</dd>
          <dt>Exemplar</dt>
          <dd>{copy || 'Não informado pela API'}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`status-stamp ${state}`}>
              {reservationStatusLabel(status, state)}
            </span>
          </dd>
          <dt>Retirada</dt>
          <dd>{formatDateTime(pickedUpAt)}</dd>
          <dt>Devolução</dt>
          <dd>{formatDateTime(returnedAt)}</dd>
        </dl>
      </Modal>
    </div>
  )
}
