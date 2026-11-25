export default function CatalogPagination({
  info,
  size,
  busy,
  onChange,
  onSize,
}) {
  return (
    <nav className="pagination" aria-label="Páginas do catálogo">
      <button
        className="button secondary"
        disabled={busy || info.pagina === 0}
        onClick={() => onChange(info.pagina - 1)}
      >
        Página anterior
      </button>
      <span aria-live="polite">
        Página {info.pagina + 1} de {Math.max(1, info.totalPaginas)} ·{' '}
        {info.totalElementos} obras
      </span>
      <label>
        Por página{' '}
        <select
          aria-label="Obras por página"
          value={size}
          disabled={busy}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {[12, 24, 48].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button secondary"
        disabled={busy || info.pagina + 1 >= info.totalPaginas}
        onClick={() => onChange(info.pagina + 1)}
      >
        Próxima página
      </button>
    </nav>
  )
}
