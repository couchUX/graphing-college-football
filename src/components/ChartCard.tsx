import React from 'react';
import { CHART_HEIGHTS } from '../constants/chartDimensions';
import ShareMenu from './ShareMenu';

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
  /**
   * Deep-link anchor (`#win-probability`). Setting it makes the card
   * shareable: the share menu appears, and the card is what its image shows.
   */
  id?: string;
  /** Builds the embed HTML. Omit for a card with no embed. */
  getEmbedCode?: () => string;
  /** Runs once the embed code is on the clipboard. */
  onEmbedCopied?: () => void;
  /** Grey the share button out, e.g. when there's no chart to share. */
  shareDisabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The white plate a chart sits on: hairline frame, ruled header, share button.
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
  id,
  getEmbedCode,
  onEmbedCopied,
  shareDisabled = false,
  className = '',
  children,
}) => (
  <div id={id} data-share-card={id ? '' : undefined} className={`plate flex flex-col ${className}`}>
    {/* min-height keeps the header the same depth whether or not it carries a
        control, so the title and the share button stay optically centered. */}
    <div className="flex min-h-[3.5rem] items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* top-px: most of these titles have no descender, so the glyphs sit
            in the upper part of the line box and read high even when the box
            itself is centered. A single pixel settles them optically. */}
        <h3 className="headline relative top-px text-[17px] font-bold leading-snug text-ink">{title}</h3>
        {headerControl}
      </div>

      {id && (
        <ShareMenu
          title={title}
          getEmbedCode={getEmbedCode}
          onEmbedCopied={onEmbedCopied}
          disabled={shareDisabled}
        />
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
