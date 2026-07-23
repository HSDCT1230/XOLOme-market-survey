import React from 'react';
import { createRoot } from 'react-dom/client';
/* 简体子集：仅 Normal + Bold，控制手机流量；Heavy/Medium 用字重近似 */
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
