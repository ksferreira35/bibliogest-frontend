export default function ReservationPagination({ view, busy, onChange }) {
  return (
    <nav className="pagination" aria-label="Páginas de reservas">
      <button
        className="button secondary"
        disabled={busy || view.page === 0}
        onClick={() => onChange(view.page - 1)}
      >
        Página anterior
      </button>
      <span aria-live="polite">
        Página {view.page + 1} · {view.items.length} reservas nesta página
      </span>
      <button
        className="button secondary"
        disabled={busy || !view.hasNext}
        onClick={() => onChange(view.page + 1)}
      >
        Próxima página
      </button>
    </nav>
  )
}
