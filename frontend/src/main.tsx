import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Warm up the Railway backend immediately on page load so it isn't
// cold-starting when the user clicks Sign In.
const API_BASE = ((import.meta as any).env?.VITE_API_URL ?? '') + '/api';
fetch(`${API_BASE}/health`, { method: 'GET', credentials: 'include' }).catch(() => {/* ignore */});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
