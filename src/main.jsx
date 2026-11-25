import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeAuth } from './auth.js'

async function start() {
  let auth
  try {
    auth = await initializeAuth()
  } catch {
    auth = { available: false }
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App auth={auth} />
    </StrictMode>,
  )
}

start()
