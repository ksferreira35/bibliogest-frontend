import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

const defaults = { textSize: 'normal', contrast: false, motion: false }
const key = 'bibliogest-accessibility'
function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    return {
      textSize: ['normal', 'large', 'extra'].includes(saved?.textSize)
        ? saved.textSize
        : 'normal',
      contrast: saved?.contrast === true,
      motion: saved?.motion === true,
    }
  } catch {
    return defaults
  }
}

export default function Accessibility() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.textSize = preferences.textSize
    root.dataset.contrast = String(preferences.contrast)
    root.dataset.reducedMotion = String(preferences.motion)
    try {
      localStorage.setItem(key, JSON.stringify(preferences))
    } catch {
      /* Funciona também sem armazenamento. */
    }
  }, [preferences])
  const update = (name, value) =>
    setPreferences((previous) => ({ ...previous, [name]: value }))
  return (
    <>
      <button
        className="accessibility-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Acessibilidade
      </button>
      {open && (
        <div className="modal-scrim">
          <Modal
            className="dialog-panel accessibility-panel"
            aria-labelledby="accessibility-title"
            onClose={() => setOpen(false)}
          >
            <button
              className="modal-close"
              aria-label="Fechar acessibilidade"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 id="accessibility-title">Acessibilidade</h2>
            <label>
              Tamanho do texto
              <select
                value={preferences.textSize}
                onChange={(event) => update('textSize', event.target.value)}
              >
                <option value="normal">Padrão</option>
                <option value="large">Ampliado (112,5%)</option>
                <option value="extra">Maior (125%)</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.contrast}
                onChange={(event) => update('contrast', event.target.checked)}
              />{' '}
              Alto contraste
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.motion}
                onChange={(event) => update('motion', event.target.checked)}
              />{' '}
              Reduzir movimento
            </label>
            <p>
              Use Tab e Shift+Tab para navegar. Escape fecha as janelas. O zoom
              do navegador também pode ser usado.
            </p>
            <button
              className="button btn btn-outlined secondary"
              onClick={() => setPreferences({ ...defaults })}
            >
              Restaurar preferências
            </button>
          </Modal>
        </div>
      )}
    </>
  )
}
