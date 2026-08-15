import React from 'react';
import {
  FileUp,
  FileDown,
  ShieldCheck,
  CheckCircle,
  Download,
  Loader2,
  HardDrive,
  Radio,
} from 'lucide-react';

export const P2PFileTransferCard = ({ transferState, onReset }) => {
  const {
    status,
    progress,
    speedMBps,
    etaSeconds,
    fileName,
    fileSize,
    isSender,
    fileBlobUrl,
  } = transferState;

  if (status === 'idle') return null;

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="w-full max-w-sm p-3.5 rounded-2xl glass-card shadow-2xl border border-white/15 my-2 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white text-black font-bold shadow-md">
            {isSender ? <FileUp className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              Direct P2P File Stream
            </h4>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 0% Server Storage (Encrypted)
            </span>
          </div>
        </div>
      </div>

      {/* File Info */}
      <div className="py-2.5 flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold text-zinc-100 truncate">{fileName || 'Transferred File'}</p>
          <p className="text-[10px] text-zinc-400">{formatBytes(fileSize)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs font-mono font-bold text-white">{progress}%</span>
          {status === 'transferring' && (
            <p className="text-[10px] text-zinc-400 font-mono">
              {speedMBps} MB/s {etaSeconds > 0 ? `(${etaSeconds}s)` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2 relative">
        <div
          className="h-full bg-white transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Action / Status */}
      <div className="flex items-center justify-between pt-1">
        {status === 'transferring' && (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-white" />
            <span>Streaming chunks over WebRTC...</span>
          </span>
        )}
        {status === 'offering' && (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse text-white" />
            <span>Connecting peer data channel...</span>
          </span>
        )}
        {status === 'completed' && (
          <div className="w-full flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Transfer Complete
            </span>
            {fileBlobUrl && (
              <a
                href={fileBlobUrl}
                download={fileName}
                className="btn-primary px-2.5 py-1 text-[10px] flex items-center gap-1 shadow-md"
              >
                <Download className="w-3 h-3" /> Save File
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default P2PFileTransferCard;
