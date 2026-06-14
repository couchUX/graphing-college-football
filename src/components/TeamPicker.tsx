import type React from 'react';
import { Combobox } from '@headlessui/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Team } from '../services/api';
import { colorPalette } from '../utils/colorPalette';
import { getTeamColors } from '../utils/teamColors';

interface TeamPickerProps {
  label: string;
  value: Team | null;
  onChange: (team: Team | null) => void;
  teams: Team[];
  loading?: boolean;
  placeholder?: string;
  // Optional inline color picker (matches the /games experience). When both
  // colorId and onColorChange are provided and a team is selected, a color
  // swatch is rendered inside the input that opens a palette dropdown.
  colorId?: string;
  onColorChange?: (colorId: string) => void;
  // When provided and a team is selected, a "Clear" link is shown in this
  // field's label row so optional pickers can be reset back to empty.
  onClear?: () => void;
}

// Solid CSS color for a team's default swatch (team colors are stored as rgba).
// Strip any alpha component rather than assuming a fixed 0.8.
const teamDefaultSwatch = (team: Team): string => {
  const color = getTeamColors(team.school).success;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : color;
};

const TeamPicker: React.FC<TeamPickerProps> = ({
  label,
  value,
  onChange,
  teams,
  loading = false,
  placeholder = 'e.g., Alabama',
  colorId,
  onColorChange,
  onClear,
}) => {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const showColors = !!colorId && !!onColorChange && !!value;
  const showClear = !!onClear && !!value;
  // Right padding clears the chevron plus any inline adornments (clear ×, swatch).
  const adornments = (showColors ? 1 : 0) + (showClear ? 1 : 0);
  const inputRightPad = adornments === 2 ? 'pr-24' : adornments === 1 ? 'pr-16' : 'pr-10';

  // Close the color dropdown on outside click.
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClick = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColorPicker]);

  const swatchColor = (() => {
    if (!value) return '#6B7280';
    if (!colorId || colorId === 'default') return teamDefaultSwatch(value);
    return colorPalette.find((c) => c.id === colorId)?.primary ?? '#6B7280';
  })();

  const filteredTeams =
    query === ''
      ? teams.slice(0, 50)
      : teams
          .filter((team) => team.school.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 20);

  return (
    <div className="flex-1 min-w-0">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 mb-2">
        {label}
      </label>
      <Combobox value={value} onChange={onChange}>
        <div className="relative">
          <Combobox.Input
            id={inputId}
            className={`w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 ${inputRightPad} shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
            displayValue={(team: Team | null) => team?.school || ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />

          {/* Inline adornments (inside the input, left of the chevron): an
              optional clear "×" and the color swatch, like the /games picker. */}
          {(showClear || showColors) && (
            <div className="absolute inset-y-0 right-9 flex items-center gap-1.5">
              {showClear && (
                <button
                  type="button"
                  className="text-neutral-400 hover:text-neutral-700 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClear?.();
                  }}
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {showColors && (
                <button
                  type="button"
                  className="w-5 h-5 rounded border border-neutral-200 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: swatchColor }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowColorPicker((s) => !s);
                  }}
                  title="Team chart color"
                  aria-label="Choose team chart color"
                />
              )}
            </div>
          )}

          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Combobox.Button>

          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {loading ? (
              <div className="px-4 py-2 text-sm text-neutral-500">Loading teams...</div>
            ) : filteredTeams.length === 0 && query !== '' ? (
              <div className="px-4 py-2 text-sm text-neutral-500">No teams found.</div>
            ) : (
              filteredTeams.map((team) => (
                <Combobox.Option
                  key={team.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-blue-100 text-blue-900' : 'text-neutral-900'
                    }`
                  }
                  value={team}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {team.school}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>

          {/* Color palette dropdown */}
          {showColors && showColorPicker && value && (
            <div
              ref={colorPickerRef}
              className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 p-2"
            >
              <div className="grid grid-cols-5 gap-1 w-40">
                <button
                  type="button"
                  onClick={() => {
                    onColorChange?.('default');
                    setShowColorPicker(false);
                  }}
                  className={`relative w-7 h-7 rounded border-2 transition-all ${
                    !colorId || colorId === 'default'
                      ? 'border-neutral-900 scale-110'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                  style={{ backgroundColor: teamDefaultSwatch(value) }}
                  title="Default team colors"
                >
                  {(!colorId || colorId === 'default') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full border border-neutral-900" />
                    </div>
                  )}
                </button>
                {colorPalette.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => {
                      onColorChange?.(color.id);
                      setShowColorPicker(false);
                    }}
                    className={`w-7 h-7 rounded border-2 transition-all ${
                      colorId === color.id
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
      </Combobox>
    </div>
  );
};

export default TeamPicker;
