import React from 'react';
import { Copy, Check } from 'lucide-react';
import { CHART_HEIGHTS } from '../constants/chartDimensions';

interface ChartCardProps {
  title: string;
  /** Optional line under the title (game context, sample size, ...). */
  subtitle?: string;
  /** Controls shown beside the title, e.g. the player-chart team filter. */
  headerControl?: React.ReactNode;
  /** Chart area height on screens ≥640px. */
  height?: number;
  /** Chart area height below 640px; defaults to `height`. */
  mobileHeight?: number;
  /** Omit to hide the embed button (charts with no embed support). */
  onCopyEmbed?: () => void;
  isCopied?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The white plate a chart sits on: hairline frame, ruled header, embed button.
 *
 * Charts render exactly once here. The previous markup mounted every chart
 * twice (a `sm:hidden` copy and a `hidden sm:block` copy) purely to vary
 * height, which doubled the number of live Chart.js canvases on a loaded page;
 * the responsive height is now a CSS custom property on a single container.
 */
const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  headerControl,
  height = CHART_HEIGHTS.DEFAULT_DESKTOP,
  mobileHeight,
  onCopyEmbed,
  isCopied = false,
  className = '',
  children,
}) => (
  <div className={`plate flex flex-col ${className}`}>
    {/* min-height keeps the header the same depth whether or not it carries a
        control, so the title and the embed button stay optically centered. */}
    <div className="flex min-h-[3.5rem] items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="headline text-[19px] font-bold leading-snug text-ink">{title}</h3>
        {headerControl}
      </div>

      {onCopyEmbed && (
        <button
          onClick={onCopyEmbed}
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border transition-colors ${
            isCopied
              ? 'border-accent text-accent'
              : 'border-neutral-300 text-byline hover:border-neutral-400 hover:text-ink'
          }`}
          title={isCopied ? 'Copied' : 'Copy embed code'}
          aria-label={isCopied ? 'Embed code copied' : `Copy embed code for ${title}`}
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>

    {subtitle && (
      <p className="border-b border-hairline px-4 py-2 text-[13px] text-byline sm:px-5">{subtitle}</p>
    )}

    <div className="p-3 sm:p-4">
      <div
        className="chart-box"
        style={
          {
            '--chart-h-mobile': `${mobileHeight ?? height}px`,
            '--chart-h': `${height}px`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  </div>
);

export default ChartCard;
