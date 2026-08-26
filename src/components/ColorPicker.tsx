import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

export const ColorPicker = React.memo(function ColorPicker({ color, onChange, className = '' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="w-full h-full rounded-full border border-gray-200 shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: color }}
        onClick={() => setIsOpen(!isOpen)}
      />
      
      {isOpen && (
        <div 
          ref={popoverRef}
          className="absolute z-50 mt-3 p-4 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 left-0"
        >
          <HexColorPicker color={color} onChange={onChange} />
          
          {/* Preset colors */}
          <div className="grid grid-cols-6 gap-2">
            {['#000000', '#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(preset => (
              <button
                key={preset}
                type="button"
                className="w-6 h-6 rounded-full border border-gray-200 shadow-sm hover:scale-110 transition-transform"
                style={{ backgroundColor: preset }}
                onClick={() => onChange(preset)}
              />
            ))}
          </div>
          
          {/* Hex Input */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 uppercase">HEX</span>
            <input 
              type="text" 
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}
    </div>
  );
});
