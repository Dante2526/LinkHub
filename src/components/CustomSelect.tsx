import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  preview?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  id?: string;
  direction?: 'up' | 'down';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  id,
  direction = 'down',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} id={id}>
      {/* Botão de disparo 100% customizado dentro do app */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 bg-gray-900/60 hover:bg-gray-800 border border-gray-200/70 rounded-2xl px-4 py-3.5 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 truncate text-left">
          {selectedOption?.preview && (
            <div className="flex-shrink-0 flex items-center justify-center">
              {selectedOption.preview}
            </div>
          )}
          <div className="truncate">
            <span className="block truncate font-bold text-white">
              {selectedOption?.label || 'Selecione...'}
            </span>
            {selectedOption?.subtitle && (
              <span className="block text-xs text-gray-500 font-normal truncate">
                {selectedOption.subtitle}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
        />
      </button>

      {/* Menu dropdown customizado da própria aplicação (não do navegador) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 left-0 right-0 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 p-1.5 max-h-72 overflow-y-auto space-y-1 backdrop-blur-md ${
              direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            style={{
              boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-500/10 text-blue-300 font-bold'
                      : 'text-gray-200 hover:bg-gray-900/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    {option.preview && (
                      <div className="flex-shrink-0 flex items-center justify-center">
                        {option.preview}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="truncate">{option.label}</div>
                      {option.subtitle && (
                        <div className="text-xs text-gray-500 font-normal truncate">
                          {option.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
