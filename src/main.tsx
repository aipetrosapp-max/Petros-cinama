import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
}

class PetrosCinemaErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#060810] text-slate-100 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942] font-black text-2xl">
              P
            </div>
            <p className="font-editorial text-2xl text-[#F5B942]">ai petros</p>
          </div>
          <p className="text-sm text-[#A3AEC2]">Petros Cinema — Aipetros-stream Recovery Mode</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#F5B942] text-[#060810] text-sm font-bold cursor-pointer transition-transform active:scale-95 shadow-lg shadow-[#F5B942]/20"
          >
            راه‌اندازی مجدد سینما (Reload Cinema)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <PetrosCinemaErrorBoundary>
    <App />
  </PetrosCinemaErrorBoundary>
);
