import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './styles.css'

// google sign-in and cookies (auth_token, googtrans) are scoped to "localhost" in dev,
// so bounce 127.0.0.1 visitors over or those features silently fail
if (window.location.hostname === '127.0.0.1') {
  window.location.href = window.location.href.replace('127.0.0.1', 'localhost');
}

// AuthProvider sits above App so every page can call useAuth() for the logged-in user/token
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
