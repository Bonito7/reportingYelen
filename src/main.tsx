import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('error', (event) => {
  const errorMsg = `Global Error: ${event.message}\nFile: ${event.filename}\nLine: ${event.lineno}`;
  console.error(errorMsg, event.error);
  // Only alert in dev or if explicitly needed, but for debugging this help:
  if (event.message.includes('error 5') || event.message.includes('connexion')) {
    alert(errorMsg);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const errorMsg = `Unhandled Rejection: ${event.reason}`;
  console.error(errorMsg);
  if (String(event.reason).includes('error 5') || String(event.reason).includes('connexion')) {
    alert(errorMsg);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
