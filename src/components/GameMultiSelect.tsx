import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TeamGame } from '../services/api';

interface GameMultiSelectProps {
  label: string;
  teamName: string;
  games: TeamGame[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  loading?: boolean;
  disabled?: boolean;
}

// Compact game label, e.g. "Week 3: vs Georgia" or "Bowl: @ Texas". Neutral-site
// games have no true home team, so use "vs" rather than a misleading "@".
const gameLabel = (game: TeamGame, teamName: string): string => {
  const isHome = game.homeTeam === teamName;
  const prefix = game.neutralSite ? 'vs' : isHome ? 'vs' : '@';
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  if (game.seasonType === 'regular') {
    return `Week ${game.week}: ${prefix} ${opponent}`;
  }
  const bowl = game.notes && /bowl|championship|playoff|cfp/i.test(game.notes) ? 'Bowl' : 'Postseason';
  return `${bowl}: ${prefix} ${opponent}`;
};

const GameMultiSelect: React.FC<GameMultiSelectProps> = ({
  label,
  teamName,
  games,
  selectedIds,
  onChange,
  loading = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const allSelected = games.length > 0 && selectedIds.length === games.length;

  const summary = loading
    ? 'Loading games...'
    : selectedIds.length === 0
      ? 'No games selected'
      : allSelected
        ? 'All games'
        : `${selectedIds.length} game${selectedIds.length === 1 ? '' : 's'}`;

  return (
    <div className="flex-1 min-w-0">
      <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled || loading || games.length === 0}
          className="relative w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 pr-10 text-left shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-neutral-100 disabled:cursor-not-allowed"
        >
          <span className="block truncate">{summary}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </span>
        </button>

        {open && games.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-300 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="sticky top-0 bg-neutral-50 border-b border-neutral-200 px-4 py-2">
              <button
                type="button"
                onClick={() => onChange(allSelected ? [] : games.map((g) => g.id))}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="py-1">
              {games.map((game) => {
                const checked = selectedIds.includes(game.id);
                return (
                  <div
                    key={game.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-neutral-50"
                  >
                    <label className="flex items-center cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onChange([...selectedIds, game.id]);
                          } else {
                            onChange(selectedIds.filter((id) => id !== game.id));
                          }
                        }}
                        className="h-4 w-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500 flex-shrink-0"
                      />
                      <span className="ml-3 text-sm text-neutral-900 truncate">
                        {gameLabel(game, teamName)}
                      </span>
                    </label>
                    {/* Quick "only this game" — handy for matchup-style comparisons */}
                    <button
                      type="button"
                      onClick={() => onChange([game.id])}
                      className="ml-3 flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Only
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameMultiSelect;
