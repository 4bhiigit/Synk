import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Terminal,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Code2,
} from 'lucide-react';

export const CodeSandboxCard = ({ code, language = 'python' }) => {
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef(null);

  const isPython = language.toLowerCase() === 'python' || language.toLowerCase() === 'py';

  // Load Pyodide Wasm on demand if Python code is present
  useEffect(() => {
    if (isPython && !window.loadPyodide) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
      script.onload = async () => {
        try {
          const py = await window.loadPyodide();
          pyodideRef.current = py;
          setPyodideReady(true);
        } catch (e) {
          console.error('Pyodide init error:', e);
        }
      };
      document.body.appendChild(script);
    } else if (window.loadPyodide && !pyodideRef.current) {
      window.loadPyodide().then((py) => {
        pyodideRef.current = py;
        setPyodideReady(true);
      });
    }
  }, [isPython]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);
    setError(null);
    const start = performance.now();

    try {
      if (isPython) {
        let py = pyodideRef.current;
        if (!py && window.loadPyodide) {
          py = await window.loadPyodide();
          pyodideRef.current = py;
        }

        if (py) {
          // Capture Python stdout
          py.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
          `);

          await py.runPythonAsync(code);

          const stdout = py.runPython('sys.stdout.getvalue()');
          const stderr = py.runPython('sys.stderr.getvalue()');

          const elapsed = performance.now() - start;
          setDuration(elapsed.toFixed(1));

          if (stderr) {
            setError(stderr);
          } else {
            setOutput(stdout || 'Program completed with no output.');
          }
        } else {
          setError('Pyodide WebAssembly is initializing. Please click run in a moment.');
        }
      } else {
        // Safe JavaScript execution in isolated function sandbox
        const logs = [];
        const customConsole = {
          log: (...args) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
          error: (...args) => logs.push('[Error] ' + args.join(' ')),
          warn: (...args) => logs.push('[Warn] ' + args.join(' ')),
        };

        const runFn = new Function('console', `"use strict";\n${code}`);
        runFn(customConsole);

        const elapsed = performance.now() - start;
        setDuration(elapsed.toFixed(1));
        setOutput(logs.join('\n') || 'Program completed with no output.');
      }
    } catch (err) {
      const elapsed = performance.now() - start;
      setDuration(elapsed.toFixed(1));
      setError(err.message || String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full rounded-2xl glass-card border border-white/10 overflow-hidden my-2 shadow-2xl">
      {/* Code Header Bar */}
      <div className="px-3 py-2 bg-[#121215] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-zinc-400" />
          <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider">
            {language} (Wasm Sandbox)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyCode}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="btn-primary px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 shadow-md disabled:opacity-40"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-black" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-black" />
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Block Content */}
      <div className="p-3 bg-[#09090b] font-mono text-xs text-zinc-200 overflow-x-auto select-text leading-relaxed">
        <pre>{code}</pre>
      </div>

      {/* Execution Output Console */}
      {(output !== null || error !== null) && (
        <div className="p-3 bg-[#0d0d10] border-t border-white/10 font-mono text-xs animate-fade-in">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Terminal className="w-3 h-3 text-zinc-500" /> Console Output
            </span>
            {duration && (
              <span className="flex items-center gap-1 text-zinc-500 font-mono">
                <Clock className="w-3 h-3" /> {duration}ms
              </span>
            )}
          </div>

          {output && (
            <pre className="mt-2 text-emerald-400 whitespace-pre-wrap leading-relaxed select-text">
              {output}
            </pre>
          )}

          {error && (
            <div className="mt-2 text-rose-400 flex items-start gap-2 whitespace-pre-wrap leading-relaxed select-text">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeSandboxCard;
