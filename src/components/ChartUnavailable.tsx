import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ChartUnavailableProps {
  /** What's missing, in the chart's own words. */
  title: string;
  /** Why it's missing, so the gap doesn't read as a bug. */
  note: string;
}

/**
 * The placeholder a chart shows when its data doesn't exist for this game or
 * season.
 *
 * Keeping the card and explaining the gap beats dropping the chart silently:
 * a missing card looks like a bug, and the reader can't tell whether the chart
 * never existed or the data didn't arrive. Lifted verbatim from the win
 * probability chart, which had the same problem first — the copy button is
 * suppressed by the caller passing no `onCopyEmbed`, since there's nothing to
 * embed.
 */
const ChartUnavailable: React.FC<ChartUnavailableProps> = ({ title, note }) => (
  <div className="flex h-full flex-col items-center justify-center text-center">
    <AlertCircle className="mb-3 h-8 w-8 text-neutral-400" />
    <p className="headline text-[18px] font-bold text-ink">{title}</p>
    <p className="mt-1 text-sm text-byline">{note}</p>
  </div>
);

export default ChartUnavailable;
