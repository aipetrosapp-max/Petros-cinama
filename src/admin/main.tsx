/**
 * Petros Cinema — Master Admin Panel entry point.
 */
import React from 'react';
import './admin.css';
import { createRoot } from 'react-dom/client';
import AdminApp from './ui/AdminApp.tsx';
import { ToastProvider } from './ui/primitives.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <React.StrictMode>
    <ToastProvider>
      <AdminApp />
    </ToastProvider>
  </React.StrictMode>
);
