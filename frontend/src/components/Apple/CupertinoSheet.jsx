import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { triggerHaptic } from '../../utils/appleHaptics';

export const CupertinoSheet = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[85vh]',
}) => {
  const handleDragEnd = (_, info) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      triggerHaptic('light');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center select-none">
          {/* Dimmed Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Elastic Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className={`w-full max-w-lg rounded-t-[32px] bg-[#141419]/95 backdrop-blur-2xl border-t border-x border-white/15 shadow-2xl z-10 flex flex-col ${maxHeight} overflow-hidden`}
          >
            {/* Grab Pill Drag Handle */}
            <div className="pt-3 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-white/25" />
            </div>

            {/* Header */}
            {title && (
              <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm md:text-base font-bold text-white leading-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">{subtitle}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white/10 text-zinc-400 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sheet Body */}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CupertinoSheet;
