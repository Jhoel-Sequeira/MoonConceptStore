import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import brandConfig from './brandConfig'

// Aplicar dinámicamente título y variables CSS globales desde brandConfig
if (typeof document !== 'undefined') {
  document.title = `${brandConfig.name} - ${brandConfig.tagline}`;
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = brandConfig.logo.main;
  const root = document.documentElement;
  
  // Inyección de variables CSS primarias si se cambian en brandConfig
  if (brandConfig.colors?.primary?.DEFAULT) {
    root.style.setProperty('--color-primary', brandConfig.colors.primary.DEFAULT);
  }
  if (brandConfig.colors?.primary?.container) {
    root.style.setProperty('--color-primary-container', brandConfig.colors.primary.container);
  }
  if (brandConfig.colors?.primary?.fixed) {
    root.style.setProperty('--color-primary-fixed', brandConfig.colors.primary.fixed);
  }
  if (brandConfig.colors?.secondary?.DEFAULT) {
    root.style.setProperty('--color-secondary', brandConfig.colors.secondary.DEFAULT);
  }
  if (brandConfig.colors?.surface?.background) {
    root.style.setProperty('--color-background', brandConfig.colors.surface.background);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
