import React from 'react';

export interface Metric {
  /** Sentence-case label, e.g. "Success rate". */
  label: string;
  value: string | number;
  /** Rendered smaller and in byline gray, e.g. "%". */
  unit?: string;
  /** Team color for the column's left rule; falls back to the page accent. */
  accent?: string;
}

/**
 * A single stat, set as a ruled column rather than a boxed tile — the most
 * "print" moment on the page. Digits are tabular so the row lines up.
 */
const MetricCard: React.FC<Metric> = ({ label, value, unit, accent }) => (
  <div
    className="border-l-2 pl-3"
    style={{ borderColor: accent || 'var(--accent)' }}
  >
    <p className="text-[13px] font-medium leading-tight text-byline">{label}</p>
    <p className="tnum mt-1 font-display text-2xl font-bold leading-none tracking-tight text-ink sm:text-[26px]">
      {value}
      {unit && <span className="ml-0.5 text-base font-semibold text-byline">{unit}</span>}
    </p>
  </div>
);

interface MetricRowProps {
  metrics: Metric[];
  /** Whose numbers these are. Named once per row so the stat labels below can
   *  stay short, instead of repeating "Alabama SR / Alabama XR / …". */
  title?: string;
  titleColor?: string;
  className?: string;
}

/**
 * The stat row under the matchup headline. Two columns on phones, four up.
 */
export const MetricRow: React.FC<MetricRowProps> = ({ metrics, title, titleColor, className = '' }) => (
  <div className={className}>
    {title && (
      <p
        className="mb-2 font-display text-[15px] font-bold tracking-tight"
        style={{ color: titleColor || 'var(--accent)' }}
      >
        {title}
      </p>
    )}
    <div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  </div>
);

export default MetricCard;
