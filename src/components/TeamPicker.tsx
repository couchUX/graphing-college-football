import type React from 'react';
import { Combobox } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { Team } from '../services/api';

interface TeamPickerProps {
  label: string;
  value: Team | null;
  onChange: (team: Team | null) => void;
  teams: Team[];
  loading?: boolean;
  placeholder?: string;
}

const TeamPicker: React.FC<TeamPickerProps> = ({
  label,
  value,
  onChange,
  teams,
  loading = false,
  placeholder = 'e.g., Alabama',
}) => {
  const inputId = useId();
  const [query, setQuery] = useState('');

  const filteredTeams =
    query === ''
      ? teams.slice(0, 20)
      : teams
          .filter((team) => team.school.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10);

  return (
    <div className="flex-1 min-w-0">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 mb-2">
        {label}
      </label>
      <Combobox value={value} onChange={onChange}>
        <div className="relative">
          <Combobox.Input
            id={inputId}
            className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2.5 pr-10 shadow-sm hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            displayValue={(team: Team | null) => team?.school || ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
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
        </div>
      </Combobox>
    </div>
  );
};

export default TeamPicker;
