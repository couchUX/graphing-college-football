import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { colorPalette, ColorOption } from '../utils/colorPalette';

interface ColorPickerProps {
  selectedColorId: string; // 'default' or a color id
  onColorChange: (colorId: string) => void;
  defaultColor: ColorOption; // The team's default color
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColorId,
  onColorChange,
  defaultColor
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get the currently selected color for display
  const getSelectedColor = () => {
    if (selectedColorId === 'default') {
      return defaultColor;
    }
    return colorPalette.find(color => color.id === selectedColorId) || defaultColor;
  };

  const selectedColor = getSelectedColor();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Color Swatch Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-1 border border-neutral-300 rounded-md bg-white hover:bg-neutral-50 transition-colors"
        title={selectedColorId === 'default' ? 'Default team colors' : 'Custom color'}
      >
        <div 
          className="w-6 h-6 rounded border border-neutral-200"
          style={{ backgroundColor: selectedColor.primary }}
        />
        <ChevronDown className="h-3 w-3 text-neutral-500" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 p-2">
          <div className="grid grid-cols-5 gap-1 w-40">
            {/* Default option */}
            <button
              type="button"
              onClick={() => {
                onColorChange('default');
                setIsOpen(false);
              }}
              className={`w-7 h-7 rounded border-2 transition-all ${
                selectedColorId === 'default' 
                  ? 'border-neutral-900 scale-110' 
                  : 'border-neutral-200 hover:border-neutral-400'
              }`}
              style={{ 
                backgroundColor: defaultColor.primary,
                position: 'relative'
              }}
              title="Default team colors"
            >
              {selectedColorId === 'default' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full border border-neutral-900"></div>
                </div>
              )}
            </button>

            {/* Color palette options */}
            {colorPalette.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => {
                  onColorChange(color.id);
                  setIsOpen(false);
                }}
                className={`w-7 h-7 rounded border-2 transition-all ${
                  selectedColorId === color.id 
                    ? 'border-neutral-900 scale-110' 
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
                style={{ backgroundColor: color.primary }}
                title={`Custom color: ${color.id}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;