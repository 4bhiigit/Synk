import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Runtime Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#09090b] text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl glass-panel border border-rose-500/20 bg-[#141418]/90 shadow-2xl text-center animate-scale-up">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400 shadow-lg">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1.5">
              Something went wrong
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              The application encountered an unexpected runtime state. You can reload the session or clear cached credentials.
            </p>

            {this.state.error && (
              <div className="p-3 mb-6 rounded-xl bg-black/60 border border-white/10 text-left overflow-x-auto">
                <p className="font-mono text-[11px] text-rose-300 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetStorage}
                className="w-full py-2.5 px-3 rounded-xl border border-white/10 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
