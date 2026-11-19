import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { mostrarAvisoExtensao, prepararExtensao } from './services/extensao'

if (!prepararExtensao()) {
  mostrarAvisoExtensao('sem-chave')
} else createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
