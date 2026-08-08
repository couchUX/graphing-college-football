import React from 'react';

export interface Metric {
  /** Sentence-case label, e.g. "Success rate". */
  label: string;
  value: string | number;
  /** Icon shown in the tinted square, e.g. <BarChart3 />. */
  icon?: React.ReactNode;
  /** Tint behind the icon — the team's light color. */
  iconBg?: string;
  /** Icon color — the team's dark color. */
  iconColor?: string;
}

/**
 * A headline stat: label and figure on the left, a team-tinted icon on the
 * right. Shared by the Games and Team Trends summaries so the two pages can't
 * drift apart again.
 */
const MetricCard: React.FC<Metric> = ({ label, value, icon, iconBg, iconColor }) => (
  <div className="plate flex items-center justify-between gap-2 p-3.5 sm:gap-3 sm:p-5">
    <div className="min-w-0">
      <p className="text-[13px] font-medium leading-snug text-byline sm:text-sm">{label}</p>
      <p className="tnum mt-1 headline text-[23px] text-ink sm:text-[25px]">
        {value}
      </p>
    </div>
    {icon && (
      <div
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg sm:h-11 sm:w-11"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
    )}
  </div>
);

interface MetricRowProps {
  metrics: Metric[];
  /** Whose numbers these are, named once per row so the stat labels below can
   *  stay short instead of repeating "Alabama SR / Alabama XR / …". */
  title?: string;
  titleColor?: string;
  className?: string;
}

export const MetricRow: React.FC<MetricRowProps> = ({ metrics, title, titleColor, className = '' }) => (
  <div className={className}>
    {title && (
      <p
        className="mb-3 headline text-[16px] font-bold"
        style={{ color: titleColor || 'var(--accent)' }}
      >
        {title}
      </p>
    )}
    {/* Two-up on phones: the Games page shows two of these rows, and one card
        per line pushes the charts a long way down. */}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  </div>
);

export default MetricCard;
