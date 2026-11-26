import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../auth.js'
import Modal from './Modal.jsx'

async function request(path, options) {
  const response = await apiFetch('usuarios', path, options)
  if (!response.ok) {
    let problem
    try {
      problem = await response.json()
    } catch {
      problem = {}
    }
    throw new Error(
      problem.detail ||
        `Não foi possível concluir a operação (${response.status}).`,
    )
  }
  return response.status === 204 ? null : response.json()
}
const body = (value) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
})
export default function UsersPanel({ subject }) {
  const [users, setUsers] = useState([]),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null),
    [creating, setCreating] = useState(false),
    [confirmation, setConfirmation] = useState(null)
  const [audit, setAudit] = useState(null),
    [auditPage, setAuditPage] = useState(0)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    senhaTemporaria: '',
  })
  const [loading, setLoading] = useState(true)
  const pending = loading || busy
  const sequence = useRef(0)
  useEffect(() => {
    const id = ++sequence.current
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      request(
        `/v1/usuarios?busca=${encodeURIComponent(search)}&pagina=${page}&tamanho=20`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (id === sequence.current) setUsers(data)
        })
        .catch((failure) => {
          if (!controller.signal.aborted) setError(failure.message)
        })
        .finally(() => {
          if (id === sequence.current) setLoading(false)
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, page, reload])
  const run = async (fn) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  const open = (user) =>
    run(async () =>
      setSelected(await request(`/v1/usuarios/${encodeURIComponent(user.id)}`)),
    )
  const auditLoad = (number) =>
    run(async () => {
      setAudit(await request(`/v1/auditoria?pagina=${number}&tamanho=20`))
      setAuditPage(number)
    })
  const mutate = () =>
    run(async () => {
      const { id, path, value, label } = confirmation
      await request(
        `/v1/usuarios/${encodeURIComponent(id)}/${path}`,
        value === null
          ? { method: 'POST' }
          : { method: 'PUT', ...body({ valor: value }) },
      )
      setConfirmation(null)
      setSelected(null)
      setNotice(
        `${label} concluído. Sessões encerradas precisam de novo login; tokens já emitidos podem durar até expirar.`,
      )
      setReload((n) => n + 1)
    })
  return (
    <section className="users-panel">
      <div className="page-heading">
        <span className="eyebrow">ADMINISTRAÇÃO · CONTAS</span>
        <h1>Usuários da biblioteca</h1>
        <p>Gerencie o acesso de leitores e bibliotecários.</p>
      </div>
      {error && (
        <p className="feedback-toast error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback-toast success" role="status">
          {notice}
        </p>
      )}
      <div className="catalog-controls">
        <label className="search-box">
          Buscar conta
          <input
            aria-label="Buscar usuários"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Nome ou e-mail"
          />
        </label>
        <button
          className="button btn btn-filled primary"
          disabled={pending}
          onClick={() => {
            setForm({ nome: '', sobrenome: '', email: '', senhaTemporaria: '' })
            setCreating(true)
          }}
        >
          Criar conta
        </button>
        <button
          className="button btn btn-outlined secondary"
          disabled={pending}
          onClick={() => auditLoad(0)}
        >
          Histórico de ações
        </button>
      </div>
      <div aria-busy={pending}>
        {users.map((user) => (
          <article className="manage-row user-row" key={user.id}>
            <div>
              <strong>
                {user.nome} {user.sobrenome}
              </strong>
              <small>{user.email}</small>
            </div>
            <span>{user.ativo ? 'Ativa' : 'Desativada'}</span>
            <button
              className="button btn btn-outlined secondary"
              disabled={pending}
              onClick={() => open(user)}
            >
              Gerenciar conta
            </button>
          </article>
        ))}
      </div>
      {!pending && !users.length && !error && <p>Nenhuma conta encontrada.</p>}
      <nav className="pagination" aria-label="Páginas de usuários">
        <button
          className="button btn btn-outlined secondary"
          disabled={pending || page === 0}
          onClick={() => setPage((n) => n - 1)}
        >
          Página anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          className="button btn btn-outlined secondary"
          disabled={pending || users.length < 20}
          onClick={() => setPage((n) => n + 1)}
        >
          Próxima página
        </button>
      </nav>
      {selected && !confirmation && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel book-form"
            aria-labelledby="user-title"
            onClose={() => setSelected(null)}
          >
            <button
              className="modal-close"
              aria-label="Fechar conta"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <h2 id="user-title">
              {selected.nome} {selected.sobrenome}
            </h2>
            <p>{selected.email}</p>
            <p>
              Perfil:{' '}
              {selected.protegido
                ? 'Conta protegida'
                : selected.bibliotecario
                  ? 'Bibliotecário'
                  : 'Leitor'}
            </p>
            {selected.protegido || selected.id === subject ? (
              <p>Esta conta é gerenciada diretamente no Keycloak.</p>
            ) : (
              <>
                <button
                  className="button btn btn-outlined secondary"
                  disabled={pending}
                  onClick={() =>
                    setConfirmation({
                      id: selected.id,
                      path: 'bibliotecario',
                      value: !selected.bibliotecario,
                      label: selected.bibliotecario
                        ? 'Remover função de bibliotecário'
                        : 'Promover a bibliotecário',
                    })
                  }
                >
                  {selected.bibliotecario
                    ? 'Remover função de bibliotecário'
                    : 'Promover a bibliotecário'}
                </button>
                <button
                  className="button btn btn-outlined secondary"
                  disabled={pending}
                  onClick={() =>
                    setConfirmation({
                      id: selected.id,
                      path: 'ativo',
                      value: !selected.ativo,
                      label: selected.ativo
                        ? 'Desativar conta'
                        : 'Ativar conta',
                    })
                  }
                >
                  {selected.ativo ? 'Desativar conta' : 'Ativar conta'}
                </button>
                <button
                  className="button btn btn-outlined secondary"
                  disabled={pending}
                  onClick={() =>
                    setConfirmation({
                      id: selected.id,
                      path: 'encerrar-sessoes',
                      value: null,
                      label: 'Encerrar sessões',
                    })
                  }
                >
                  Encerrar sessões
                </button>
              </>
            )}
          </Modal>
        </div>
      )}
      {confirmation && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel"
            aria-labelledby="confirm-user-title"
            onClose={() => {
              if (!pending) setConfirmation(null)
            }}
          >
            <h2 id="confirm-user-title">{confirmation.label}?</h2>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            <p>A alteração será registrada no histórico administrativo.</p>
            <div className="form-actions flex flex-wrap justify-end gap-3">
              <button
                className="button btn btn-outlined secondary"
                disabled={pending}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                className="button btn btn-filled primary"
                disabled={pending}
                onClick={mutate}
              >
                Confirmar alteração
              </button>
            </div>
          </Modal>
        </div>
      )}
      {creating && (
        <div className="modal-scrim">
          <Modal
            as="form"
            className="dialog-panel book-form"
            aria-labelledby="create-user-title"
            onClose={() => {
              if (!pending) {
                setCreating(false)
                setForm({})
              }
            }}
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                await request('/v1/usuarios', { method: 'POST', ...body(form) })
                setCreating(false)
                setForm({})
                setNotice(
                  'Conta criada. A senha temporária deverá ser trocada no primeiro acesso.',
                )
                setReload((n) => n + 1)
              })
            }}
          >
            <h2 id="create-user-title">Criar conta de leitor</h2>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            {['nome', 'sobrenome', 'email', 'senhaTemporaria'].map((field) => (
              <label key={field}>
                {
                  {
                    nome: 'Nome',
                    sobrenome: 'Sobrenome',
                    email: 'E-mail',
                    senhaTemporaria: 'Senha temporária',
                  }[field]
                }
                <input
                  required
                  type={
                    field === 'senhaTemporaria'
                      ? 'password'
                      : field === 'email'
                        ? 'email'
                        : 'text'
                  }
                  minLength={field === 'senhaTemporaria' ? 12 : 1}
                  maxLength={
                    field === 'senhaTemporaria'
                      ? 128
                      : field === 'email'
                        ? 254
                        : 100
                  }
                  autoComplete={
                    field === 'senhaTemporaria' ? 'new-password' : 'off'
                  }
                  value={form[field] || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [field]: e.target.value }))
                  }
                />
              </label>
            ))}
            <p>
              A senha não será salva no navegador. A conta começa como leitor.
            </p>
            <div className="form-actions flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="button btn btn-outlined secondary"
                disabled={pending}
                onClick={() => {
                  setCreating(false)
                  setForm({})
                }}
              >
                Cancelar
              </button>
              <button className="button btn btn-filled primary" disabled={pending}>
                Criar usuário
              </button>
            </div>
          </Modal>
        </div>
      )}
      {audit && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel audit-panel"
            aria-labelledby="audit-title"
            onClose={() => setAudit(null)}
          >
            <button
              className="modal-close"
              aria-label="Fechar histórico"
              onClick={() => setAudit(null)}
            >
              ×
            </button>
            <h2 id="audit-title">Histórico de ações</h2>
            {audit.length ? (
              audit.map((row) => (
                <article key={row.id}>
                  <strong>
                    {row.acao} · {row.estado}
                  </strong>
                  <p>
                    {new Date(row.criada_em).toLocaleString('pt-BR')} · Operador{' '}
                    {row.ator}
                  </p>
                  <p>Conta: {row.alvo || 'Nova conta'}</p>
                </article>
              ))
            ) : (
              <p>Nenhuma ação registrada nesta página.</p>
            )}
            <div className="pagination">
              <button
                className="button btn btn-outlined secondary"
                disabled={pending || auditPage === 0}
                onClick={() => auditLoad(auditPage - 1)}
              >
                Anteriores
              </button>
              <button
                className="button btn btn-outlined secondary"
                disabled={pending || audit.length < 20}
                onClick={() => auditLoad(auditPage + 1)}
              >
                Próximas
              </button>
            </div>
          </Modal>
        </div>
      )}
    </section>
  )
}
