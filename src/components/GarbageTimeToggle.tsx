import React from 'react';
import { GARBAGE_TIME_THRESHOLDS } from '../utils/garbageTime';

interface GarbageTimeToggleProps {
  exclude: boolean;
  onChange: (exclude: boolean) => void;
  /** Rush and pass plays snapped in garbage time, whether or not they count right now. */
  garbagePlays: number;
  /** What the count covers, for the "none" line: "this game", "these games". */
  scope?: string;
  className?: string;
}

const [Q1, Q2, Q3, Q4] = GARBAGE_TIME_THRESHOLDS;

/** The rule, for the hover text. */
export const GARBAGE_TIME_RULE =
  `Garbage time is any play snapped with a lead of more than ${Q1} points in the first quarter, ` +
  `${Q2} in the second, ${Q3} in the third or ${Q4} in the fourth (the SP+ definition). ` +
  'Overtime always counts, and plays count again if the trailing team gets back inside the margin.';

/**
 * "Exclude garbage time", with how many plays that takes out. A switch rather
 * than a checkbox: it changes the numbers on screen the moment it's flipped.
 */
const GarbageTimeToggle: React.FC<GarbageTimeToggleProps> = ({
  exclude,
  onChange,
  garbagePlays,
  scope = 'this game',
  className = '',
}) => {
  const plays = `${garbagePlays} garbage-time ${garbagePlays === 1 ? 'play' : 'plays'}`;
  const note =
    garbagePlays === 0 ? `No garbage time in ${scope}` : exclude ? `${plays} excluded` : `Counting ${plays}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`} title={GARBAGE_TIME_RULE}>
      <button
        type="button"
        role="switch"
        aria-checked={exclude}
        onClick={() => onChange(!exclude)}
        className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-medium text-ink"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${
            exclude ? 'bg-accent' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              exclude ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </span>
        Exclude garbage time
      </button>
      <span className="text-sm text-byline" aria-live="polite">
        {note}
      </span>
    </div>
  );
};

export default GarbageTimeToggle;
