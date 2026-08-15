import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pen,
  Eraser,
  Trash2,
  Undo2,
  X,
  Download,
} from 'lucide-react';

const COLORS = [
  '#ffffff',
  '#a1a1aa',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

export const SharedWhiteboard = ({
  isOpen,
  onClose,
  onSendCanvasDraw,
  onSendCanvasClear,
  subscribe,
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [activeTool, setActiveTool] = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);

  const strokeBufferRef = useRef([]);
  const throttleTimerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const drawSegment = useCallback((prevX, prevY, currX, currY, strokeColor, strokeWidth, isEraser) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeWidth * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }, []);

  const allStrokesRef = useRef([]);

  // Initialize Canvas context and replay strokes
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;

      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      contextRef.current = ctx;

      // Replay all strokes
      if (allStrokesRef.current && allStrokesRef.current.length > 0) {
        allStrokesRef.current.forEach((stroke) => {
          drawSegment(
            stroke.prevX,
            stroke.prevY,
            stroke.currX,
            stroke.currY,
            stroke.color,
            stroke.width,
            stroke.isEraser
          );
        });
      }

      const dataUrl = canvas.toDataURL();
      setHistory([dataUrl]);
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, drawSegment]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setHistory((prev) => [...prev.slice(-15), dataUrl]);
  };

  const flushStrokes = useCallback(() => {
    if (strokeBufferRef.current.length > 0) {
      allStrokesRef.current.push(...strokeBufferRef.current);
      onSendCanvasDraw([...strokeBufferRef.current]);
      strokeBufferRef.current = [];
    }
  }, [onSendCanvasDraw]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getCoordinates(e);
    lastPosRef.current = { x, y };
    isDrawingRef.current = true;

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setInterval(flushStrokes, 40);
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getCoordinates(e);
    const isEraser = activeTool === 'eraser';

    drawSegment(
      lastPosRef.current.x,
      lastPosRef.current.y,
      x,
      y,
      color,
      lineWidth,
      isEraser
    );

    const stroke = {
      prevX: lastPosRef.current.x,
      prevY: lastPosRef.current.y,
      currX: x,
      currY: y,
      color: color,
      width: lineWidth,
      isEraser: isEraser,
    };

    strokeBufferRef.current.push(stroke);
    allStrokesRef.current.push(stroke);
    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    flushStrokes();

    if (throttleTimerRef.current) {
      clearInterval(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    saveToHistory();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      allStrokesRef.current = [];
      saveToHistory();
      if (onSendCanvasClear) {
        onSendCanvasClear();
      }
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    const lastState = newHistory[newHistory.length - 1];

    const img = new Image();
    img.src = lastState;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
        setHistory(newHistory);
      }
    };
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `nexus-whiteboard-${Date.now()}.png`;
    a.click();
  };

  // Direct socket event listeners (Draws directly on canvas without React state overhead!)
  useEffect(() => {
    if (!subscribe) return;

    const unsubDraw = subscribe('canvas_draw', (payload) => {
      const strokes = payload.strokes || [];
      allStrokesRef.current.push(...strokes);
      strokes.forEach((stroke) => {
        drawSegment(
          stroke.prevX,
          stroke.prevY,
          stroke.currX,
          stroke.currY,
          stroke.color,
          stroke.width,
          stroke.isEraser
        );
      });
    });

    const unsubClear = subscribe('canvas_clear', () => {
      allStrokesRef.current = [];
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    return () => {
      unsubDraw();
      unsubClear();
    };
  }, [subscribe, drawSegment]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/80 animate-fade-in">
      <div className="w-full max-w-5xl h-[88vh] rounded-2xl md:rounded-3xl glass-panel shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="p-3 bg-[#09090b] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white text-black font-bold shadow-md">
              <Pen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs md:text-sm text-white flex items-center gap-2">
                Live Whiteboard <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-medium">Real-Time Sync</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={handleDownload} className="btn-icon p-1.5" title="Download Canvas">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="btn-icon p-1.5" title="Close Whiteboard">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar & Canvas Workspace */}
        <div className="flex-1 relative bg-[#09090b] overflow-hidden flex flex-col">
          {/* Floating Controls Bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-2xl glass-panel shadow-xl border border-white/15 flex items-center gap-2.5">
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-xl">
              <button
                onClick={() => setActiveTool('pen')}
                className={`p-1.5 rounded-lg transition-all ${
                  activeTool === 'pen' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Pencil"
              >
                <Pen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                className={`p-1.5 rounded-lg transition-all ${
                  activeTool === 'eraser' ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
                title="Eraser"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-px h-4 bg-white/10" />

            {activeTool === 'pen' && (
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-4 h-4 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-medium">{lineWidth}px</span>
              <input
                type="range"
                min="1"
                max="20"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-14 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-1">
              <button onClick={handleUndo} className="p-1.5 rounded-lg text-zinc-400 hover:text-white" title="Undo">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleClear} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400" title="Clear">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair touch-none"
          />
        </div>
      </div>
    </div>
  );
};

export default SharedWhiteboard;
