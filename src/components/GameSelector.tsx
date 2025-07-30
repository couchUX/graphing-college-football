import React, { useState } from 'react';
import { Play, ChevronDown, Check } from 'lucide-react';
import { Listbox } from '@headlessui/react';

interface GameSelectorProps {
  onFetchData: (params: {
    year: number;
    week: number;
    seasonType: string;
    team: string;
  }) => void;
  isLoading: boolean;
}

const GameSelector: React.FC<GameSelectorProps> = ({ onFetchData, isLoading }) => {
  const [year, setYear] = useState<number>(2024);
  const [week, setWeek] = useState<number>(1);
  const [seasonType, setSeasonType] = useState<string>('postseason');
  const [team, setTeam] = useState<string>('Alabama');

  const handleFetchData = () => {
    onFetchData({ year, week, seasonType, team });
  };

  const years = [2024, 2023, 2022, 2021, 2020];
  const seasonTypes = [
    { value: 'regular', label: 'Regular Season' },
    { value: 'postseason', label: 'Postseason' }
  ];
  const weeks = Array.from({ length: 15 }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Year Dropdown */}
      <div className="flex-shrink-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Year
        </label>
        <Listbox value={year} onChange={setYear}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-slate-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default">
              <span className="block truncate">{year}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {years.map((yearOption) => (
                <Listbox.Option
                  key={yearOption}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
                    }`
                  }
                  value={yearOption}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {yearOption}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      {/* Season Type Dropdown */}
      <div className="flex-shrink-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Season Type
        </label>
        <Listbox value={seasonType} onChange={setSeasonType}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-slate-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default">
              <span className="block truncate">
                {seasonTypes.find(type => type.value === seasonType)?.label}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {seasonTypes.map((type) => (
                <Listbox.Option
                  key={type.value}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
                    }`
                  }
                  value={type.value}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {type.label}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      {/* Week Dropdown */}
      <div className="flex-shrink-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Week
        </label>
        <Listbox value={week} onChange={setWeek}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-slate-300 rounded-lg px-3 py-3 pr-10 text-left shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors cursor-default">
              <span className="block truncate">Week {week}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {weeks.map((weekOption) => (
                <Listbox.Option
                  key={weekOption}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-emerald-100 text-emerald-900' : 'text-slate-900'
                    }`
                  }
                  value={weekOption}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        Week {weekOption}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-600">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

      {/* Team Input */}
      <div className="flex-grow min-w-0">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Team
        </label>
        <input
          type="text"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          placeholder="e.g., Alabama"
          className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Fetch Button */}
      <div className="flex-shrink-0">
        <button
          onClick={handleFetchData}
          disabled={isLoading || !team.trim()}
          className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-medium rounded-lg shadow-sm transition-colors disabled:cursor-not-allowed"
        >
          <span>{isLoading ? 'Loading...' : 'Fetch Play Data'}</span>
          <Play className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default GameSelector;