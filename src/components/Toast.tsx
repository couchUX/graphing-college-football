import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'success', 
  isVisible, 
  onClose, 
  duration = 3000 
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const typeStyles = {
    success: 'bg-gray-800 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  const icons = {
    success: <Check className="h-5 w-5 text-green-600" strokeWidth={3} />,
    error: <X className="h-5 w-5" />,
    info: <Check className="h-5 w-5 text-green-600" strokeWidth={3} />
  };

  if (!isVisible && !show) return null;

  return (
    <div className="fixed bottom-8 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 sm:w-auto z-50">
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-out w-full sm:w-auto
          ${show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          ${typeStyles[type]}
        `}
      >
        {icons[type]}
        <span className="text-sm font-medium">
          {message.includes('Embed code copied for ') ? (
            <>
              Embed code copied for <strong>{message.replace('Embed code copied for ', '')}</strong>
            </>
          ) : (
            message
          )}
        </span>
        <button
          onClick={() => {
            setShow(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;