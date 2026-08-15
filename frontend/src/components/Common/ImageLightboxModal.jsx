import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

export const ImageLightboxModal = ({ isOpen, imageUrl, onClose, imageName = 'photo' }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setRotation(0);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.3, 3.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.3, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${imageName}_${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in select-none">
      {/* Top Floating Action Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-white/10">
            {imageName}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 bg-[#141417]/90 px-3 py-1.5 rounded-2xl border border-white/15 shadow-2xl">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-zinc-400 min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={handleRotate}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Download Full Image"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Close Viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="w-full h-full flex items-center justify-center p-4 overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={imageUrl}
          alt={imageName}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.15s ease-out',
          }}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
        />
      </div>
    </div>
  );
};

export default ImageLightboxModal;
