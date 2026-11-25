import { useState } from 'react'
import { display } from '../domain/catalog.js'

export default function BookForm({
  book,
  categories,
  authors,
  busy,
  onClose,
  onSubmit,
  onCreateSupport,
}) {
  const [form, setForm] = useState({
    titulo: book?.titulo || '',
    categoriaId: book?.categoria?.id || '',
    autorIds: book?.autor?.map((author) => author.id) || [],
    volume: book?.volume || '',
    isbn: book?.isbn || '',
    descricao: book?.descricao || '',
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-form-title"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            titulo: form.titulo.trim(),
            categoriaId: form.categoriaId,
            autorIds: form.autorIds,
            volume: form.volume.trim() || null,
            isbn: form.isbn.trim() || null,
            descricao: form.descricao.trim() || null,
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
        <span className="eyebrow">
          ACERVO · {book ? 'EDIÇÃO DO REGISTRO' : 'NOVO REGISTRO'}
        </span>
        <h2 id="book-form-title">{book ? 'Editar obra' : 'Cadastrar obra'}</h2>
        <label>
          Título
          <input
            required
            maxLength={100}
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
              maxLength={50}
              value={form.volume}
              onChange={(event) => set('volume', event.target.value)}
            />
          </label>
          <label>
            ISBN (opcional)
            <input
              maxLength={30}
              value={form.isbn}
              onChange={(event) => set('isbn', event.target.value)}
            />
          </label>
        </div>
        <label>
          Descrição (opcional)
          <textarea
            rows={6}
            maxLength={5000}
            value={form.descricao}
            onChange={(event) => set('descricao', event.target.value)}
            placeholder="Escreva uma sinopse da obra…"
            aria-describedby="descricao-ajuda"
          />
        </label>
        <small id="descricao-ajuda" className="description-hint">
          {form.descricao.length}/5000 caracteres
        </small>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || !form.categoriaId || form.autorIds.length === 0}
          >
            {book ? 'Salvar alterações' : 'Salvar obra no Acervo'}
          </button>
        </div>
      </form>
    </div>
  )
}
