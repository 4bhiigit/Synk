import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ text = 'Loading...', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 text-gray-400 ${className}`}>
      <Loader2 className={`${sizeClasses[size] || sizeClasses.md} animate-spin text-indigo-500`} />
      {text && <span className="text-sm font-medium animate-pulse">{text}</span>}
    </div>
  );
};

export default Loader;
