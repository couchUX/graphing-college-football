import React from 'react';

export interface Metric {
  /** Sentence-case label, e.g. "Success rate". */
  label: string;
  value: string | number;
  /** Icon shown in the tinted side panel, e.g. <BarChart3 />. */
  icon?: React.ReactNode;
  /** Panel tint — the team's light color. */
  iconBg?: string;
  /** Icon color — the team's dark color. */
  iconColor?: string;
}

/**
 * A headline stat: a team-tinted panel down the left edge, then the label and
 * figure. The panel runs the full height of the card and sits flush to its
 * edges, giving the card something to stand on. Being flush also lets it go
 * narrow on phones without leaving awkward gaps around it, which buys the
 * label and figure more room in the two-up layout.
 *
 * Shared by the Games and Team Trends summaries so the two can't drift apart.
 */
const MetricCard: React.FC<Metric> = ({ label, value, icon, iconBg, iconColor }) => (
  <div className="plate flex items-stretch overflow-hidden">
    {icon && (
      <div
        className="flex w-8 flex-none items-center justify-center sm:w-12"
        style={{ backgroundColor: iconBg, color: iconColor }}
        aria-hidden="true"
      >
        {icon}
      </div>
    )}
    <div className="min-w-0 px-3 py-3.5 sm:px-4 sm:py-4">
      <p className="text-[13px] font-medium leading-snug text-byline sm:text-sm">{label}</p>
      <p className="tnum headline mt-1 text-[23px] text-ink sm:text-[25px]">{value}</p>
    </div>
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
