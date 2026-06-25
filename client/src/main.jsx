import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.addEventListener('error', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'debug-error-banner';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100vw';
  errorDiv.style.height = '50vh';
  errorDiv.style.background = 'darkred';
  errorDiv.style.color = 'white';
  errorDiv.style.zIndex = '99999';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.overflow = 'auto';
  errorDiv.innerHTML = `<h1>Runtime Error</h1><pre>${event.error ? event.error.stack : event.message}</pre>`;
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'debug-rejection-banner';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100vw';
  errorDiv.style.height = '50vh';
  errorDiv.style.background = 'darkred';
  errorDiv.style.color = 'white';
  errorDiv.style.zIndex = '99999';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.overflow = 'auto';
  errorDiv.innerHTML = `<h1>Unhandled Rejection</h1><pre>${event.reason ? event.reason.stack || event.reason : 'Unknown rejection'}</pre>`;
  document.body.appendChild(errorDiv);
});

const originalConsoleError = console.error;
console.error = function (...args) {
  originalConsoleError.apply(console, args);
  const errorDiv = document.createElement('div');
  errorDiv.id = 'debug-console-banner';
  errorDiv.style.position = 'fixed';
  errorDiv.style.bottom = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100vw';
  errorDiv.style.height = '50vh';
  errorDiv.style.background = '#800080'; // purple for console error
  errorDiv.style.color = 'white';
  errorDiv.style.zIndex = '99999';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.overflow = 'auto';
  
  const formattedMessage = args.map(arg => {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    } else if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    } else {
      return String(arg);
    }
  }).join(' ');
  
  errorDiv.innerHTML = `<h1>Console Error</h1><pre>${formattedMessage}</pre>`;
  document.body.appendChild(errorDiv);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)