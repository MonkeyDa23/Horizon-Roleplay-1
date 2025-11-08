
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// FIX: Guard against document access in non-browser environments.
if (typeof document !== 'undefined') {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    throw new Error("Could not find root element to mount to");
  }
}
