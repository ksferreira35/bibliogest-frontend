import { useState } from 'react'
import { display } from '../domain/catalog.js'

export default function BookForm({
  categories,
  authors,
  busy,
  onClose,
  onSubmit,
  onCreateSupport,
}) {
  const [form, setForm] = useState({
    titulo: '',
    categoriaId: '',
    autorIds: [],
    volume: '',
    isbn: '',
  })
  const [categoryName, setCategoryName] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [supportError, setSupportError] = useState('')
  const set = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }))
  const createCategory = async () => {
    if (!categoryName.trim()) return
    setSupportError('')
    try {
      const created = await onCreateSupport(
        'acervo',
        '/v1/categorias',
        categoryName.trim(),
      )
      if (created?.id != null) set('categoriaId', String(created.id))
      setCategoryName('')
    } catch (failure) {
      setSupportError(failure.message)
    }
  }
  const createAuthor = async () => {
    if (!authorName.trim()) return
    setSupportError('')
    try {
      const created = await onCreateSupport(
        'acervo',
        '/v1/autores',
        authorName.trim(),
      )
      if (created?.id != null)
        set('autorIds', [...form.autorIds, String(created.id)])
      setAuthorName('')
    } catch (failure) {
      setSupportError(failure.message)
    }
  }
  return (
    <div className="modal-scrim">
      <form
        className="modal book-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            titulo: form.titulo,
            categoriaId: form.categoriaId,
            autorIds: form.autorIds,
            ...(form.volume && { volume: form.volume }),
            ...(form.isbn && { isbn: form.isbn }),
          })
        }}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <span className="eyebrow">ACERVO · NOVO REGISTRO</span>
        <h2>Cadastrar obra</h2>
        <label>
          Título
          <input
            required
            value={form.titulo}
            onChange={(event) => set('titulo', event.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            required
            value={form.categoriaId}
            onChange={(event) => set('categoriaId', event.target.value)}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {display(item)}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-create">
          <input
            aria-label="Nome da nova categoria"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Nova categoria"
          />
          <button
            type="button"
            className="button secondary"
            onClick={createCategory}
          >
            Cadastrar categoria
          </button>
        </div>
        <label>
          Autor(es)
          <select
            multiple
            value={form.autorIds.map(String)}
            onChange={(event) =>
              set(
                'autorIds',
                [...event.target.selectedOptions].map((option) => option.value),
              )
            }
          >
            {authors.map((item) => (
              <option key={item.id} value={item.id}>
                {display(item)}
              </option>
            ))}
          </select>
          <small>Use Ctrl ou ⌘ para selecionar mais de um autor.</small>
        </label>
        <div className="inline-create">
          <input
            aria-label="Nome do novo autor"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Novo autor"
          />
          <button
            type="button"
            className="button secondary"
            onClick={createAuthor}
          >
            Cadastrar autor
          </button>
        </div>
        {supportError && (
          <p className="inline-error" role="alert">
            {supportError}
          </p>
        )}
        <div className="form-pair">
          <label>
            Volume (opcional)
            <input
              value={form.volume}
              onChange={(event) => set('volume', event.target.value)}
            />
          </label>
          <label>
            ISBN (opcional)
            <input
              value={form.isbn}
              onChange={(event) => set('isbn', event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || !form.categoriaId || form.autorIds.length === 0}
          >
            Salvar obra no Acervo
          </button>
        </div>
      </form>
    </div>
  )
}
