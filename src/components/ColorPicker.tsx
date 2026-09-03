import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { X } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
  title?: string;
}

export const ColorPicker = React.memo(function ColorPicker({ 
  color, 
  onChange, 
  className = '',
  title = 'Escolher Cor'
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 256;
    const popoverHeight = 350;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left;
    // On mobile / small screens (< 520px), center horizontally on screen
    if (viewportWidth < 520) {
      left = Math.max(12, Math.round((viewportWidth - popoverWidth) / 2));
    } else {
      // Desktop / tablet: align with trigger, but clamp strictly within viewport
      if (left + popoverWidth > viewportWidth - 16) {
        left = viewportWidth - popoverWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }
    }

    // Vertical placement: prefer below trigger
    let top = rect.bottom + 8;
    // If it overflows the bottom
    if (top + popoverHeight > viewportHeight - 16) {
      // If it fits above trigger, flip above
      if (rect.top - popoverHeight - 8 > 16) {
        top = rect.top - popoverHeight - 8;
      } else {
        // Otherwise, clamp to viewport bottom
        top = Math.max(16, viewportHeight - popoverHeight - 16);
      }
    }

    setCoords({ top, left });
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    calculatePosition();

    function handleScrollOrResize() {
      calculatePosition();
    }

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, calculatePosition]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="w-full h-full rounded-full border border-gray-200 shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={handleToggle}
        aria-label={title}
      />
      
      {isOpen && (
        <>
          {/* Backdrop para fechar ao tocar fora */}
          <div 
            className="fixed inset-0 z-[90] bg-black/25 backdrop-blur-[0.5px] sm:bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          {/* Janela de Seleção de Cor com posicionamento dinâmico sem cortar na tela */}
          <div 
            ref={popoverRef}
            style={{ 
              top: `${coords.top}px`, 
              left: `${coords.left}px`,
              width: '256px',
              maxWidth: 'calc(100vw - 24px)'
            }}
            className="fixed z-[100] p-4 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Cabeçalho com botão fechar */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">{title}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Seletor Gráfico */}
            <div className="flex justify-center [&_.react-colorful]:w-full [&_.react-colorful]:h-[170px]">
              <HexColorPicker color={color} onChange={onChange} />
            </div>
            
            {/* Cores predefinidas */}
            <div className="grid grid-cols-6 gap-2 pt-1">
              {['#000000', '#ffffff', '#1f2937', '#2563eb', '#10b981', '#ef4444'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  className={`w-7 h-7 rounded-full border border-gray-200 shadow-xs hover:scale-110 active:scale-95 transition-transform ${
                    color.toLowerCase() === preset.toLowerCase() ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: preset }}
                  onClick={() => onChange(preset)}
                />
              ))}
            </div>
            
            {/* Campo HEX */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-bold text-gray-500 uppercase">HEX</span>
              <input 
                type="text" 
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
});
