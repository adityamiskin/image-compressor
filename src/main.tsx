import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if (!document.documentElement.classList.contains('dark')) {
  document.documentElement.classList.add('dark')
}

document.body.classList.add('bg-black')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
