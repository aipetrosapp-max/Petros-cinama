import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class PetrosCinemaErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PetrosCinema caught runtime error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('AiPetrosUniverseVaultDB');
      }
    } catch (e) {
      console.warn('Reset error:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#060810] text-slate-100 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942] font-black text-2xl shadow-lg shadow-[#F5B942]/20">
              P
            </div>
            <p className="font-editorial text-2xl text-[#F5B942]">ai petros</p>
          </div>
          <p className="text-sm font-semibold text-[#A3AEC2]">Petros Cinema — Aipetros-stream Recovery Mode</p>

          {this.state.error && (
            <div className="max-w-md w-full p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-left text-xs text-red-200 font-mono overflow-auto max-h-36">
              <p className="font-bold text-red-400 mb-1">Runtime Diagnostics:</p>
              <p>{this.state.error.message || String(this.state.error)}</p>
              {this.state.error.stack && (
                <pre className="text-[10px] text-red-300/70 mt-1 whitespace-pre-wrap">
                  {this.state.error.stack.slice(0, 300)}...
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => {
                try { localStorage.removeItem('aipetros_universe_inapp_memory_v1'); sessionStorage.clear(); } catch(e){} this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#F5B942] text-[#060810] text-sm font-bold cursor-pointer transition-transform active:scale-95 shadow-lg shadow-[#F5B942]/20"
            >
              راه‌اندازی مجدد سینما (Reload Cinema)
            </button>
            <button
              type="button"
              onClick={this.handleHardReset}
              className="min-h-[44px] px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 text-xs font-semibold cursor-pointer transition-transform active:scale-95"
            >
              پاکسازی کش و ریست (Clear Cache & Reset)
            </button>
          </div>
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
