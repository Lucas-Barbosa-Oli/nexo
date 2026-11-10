import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import 'katex/dist/katex.min.css';
registerSW({onNeedRefresh(){window.dispatchEvent(new Event('nexo-update'));}});
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
