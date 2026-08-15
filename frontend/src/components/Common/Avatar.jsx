import React from 'react';

const sizeMap = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl font-bold',
};

const dotSizeMap = {
  xs: 'w-2 h-2 bottom-0 right-0 border',
  sm: 'w-2.5 h-2.5 bottom-0 right-0 border-2',
  md: 'w-3 h-3 bottom-0.5 right-0.5 border-2',
  lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5 border-2',
  xl: 'w-5 h-5 bottom-1 right-1 border-2',
};

// Deterministic gradient colors based on string
const getGradientFromName = (name = '') => {
  const gradients = [
    'from-indigo-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-violet-600 to-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
};

export const Avatar = ({
  src,
  name = 'User',
  size = 'md',
  isOnline = false,
  showStatus = false,
  className = '',
}) => {
  const initial = (name || '?').charAt(0).toUpperCase();
  const gradient = getGradientFromName(name);

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeMap[size] || sizeMap.md} rounded-full object-cover ring-1 ring-white/10`}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeMap[size] || sizeMap.md} rounded-full bg-gradient-to-tr ${gradient} text-white font-semibold flex items-center justify-center shadow-inner select-none`}
        >
          {initial}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute rounded-full border-gray-900 ${dotSizeMap[size] || dotSizeMap.md} ${
            isOnline ? 'bg-emerald-500 shadow-sm' : 'bg-gray-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
        </span>
      )}
    </div>
  );
};

export default Avatar;
