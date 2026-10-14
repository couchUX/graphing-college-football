import { Chart } from 'chart.js';

// Hi-res PNG of a chart card, the way it sits on the page: the white plate on
// paper, with the same clear margin on every side.
//
// The card is rasterized from the live DOM (modern-screenshot draws a clone of
// it through an SVG foreignObject), so the title, the HTML legends, the Game
// Wave's SVG and the box score tables all come out as they look on screen —
// there's no second, image-only rendering of any chart to keep in step.

/** `paper` in tailwind.config.js — the ground every plate sits on. */
const PAPER = '#FBFAF7';

/** Clear paper around the card, in CSS px. Scaled with the rest of the image. */
const MARGIN = 32;

/**
 * Pixel density. 3× for an ordinary card; a full-width one eases toward 2× so
 * the file stays a sensible size (a 1,200px card at 3× is a 3,800px PNG).
 */
const MAX_SCALE = 3;
const MIN_SCALE = 2;
const MAX_OUTPUT_WIDTH = 3200;

/** Mark anything inside a card that is page furniture rather than content. */
export const SHARE_EXCLUDE_ATTR = 'data-share-exclude';

/**
 * Form controls never make it into an image. They're for working the page,
 * not reading the chart, and a native <select> doesn't survive the trip
 * anyway: its chevron lands in the wrong corner and it reflows the header.
 */
const CONTROL_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

const inImage = (node: Node): boolean =>
  !(node instanceof Element && (CONTROL_TAGS.has(node.tagName) || node.hasAttribute(SHARE_EXCLUDE_ATTR)));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Re-render every Chart.js chart inside `root` at `ratio`, run `fn`, then put
 * them back.
 *
 * A canvas is a bitmap at the screen's density, and the capture copies that
 * bitmap as it stands — on a 1× monitor a 3× image would be a blurry upscale.
 * Only the backing store changes, never the CSS size, and each redraw is
 * synchronous, so nothing on the page visibly moves.
 *
 * The ratio goes on `config.options` (the plain object the chart was built
 * from), not `chart.options`: that is Chart.js v4's resolved proxy, and the
 * `update` is what makes the resolver read the new value.
 */
const withChartsAtRatio = async <T>(root: HTMLElement, ratio: number, fn: () => Promise<T>): Promise<T> => {
  const charts = Array.from(root.querySelectorAll('canvas'))
    .map(canvas => Chart.getChart(canvas))
    .filter((chart): chart is Chart => chart !== undefined);

  const saved = charts.map(chart => chart.config.options?.devicePixelRatio);

  const applyRatio = (chart: Chart, value: number | undefined) => {
    const options = (chart.config.options ??= {});
    if (value === undefined) delete options.devicePixelRatio;
    else options.devicePixelRatio = value;
    // A running animation would defer the resize to its next frame — after
    // the capture has already copied the canvas.
    chart.stop();
    chart.update('none');
    chart.resize();
  };

  charts.forEach(chart => applyRatio(chart, ratio));
  try {
    return await fn();
  } finally {
    charts.forEach((chart, i) => applyRatio(chart, saved[i]));
  }
};

/** Render a card to a PNG blob: the plate on paper, with an even margin. */
export const renderCardImage = async (card: HTMLElement): Promise<Blob> => {
  // Only fetched the first time someone asks for an image.
  const { domToCanvas } = await import('modern-screenshot');

  const { width } = card.getBoundingClientRect();
  const scale = clamp(MAX_OUTPUT_WIDTH / (width + 2 * MARGIN), MIN_SCALE, MAX_SCALE);

  const plate = await withChartsAtRatio(card, scale, () =>
    domToCanvas(card, {
      scale,
      // Transparent, so the plate's rounded corners show the paper below.
      backgroundColor: null,
      filter: inImage,
      // Applied to the clone only. Margins belong to the page's layout, and
      // the outline is the deep-link highlight — neither is part of the card.
      style: { margin: '0', outline: 'none', animation: 'none' },
    })
  );

  const pad = Math.round(MARGIN * scale);
  const out = document.createElement('canvas');
  out.width = plate.width + pad * 2;
  out.height = plate.height + pad * 2;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(plate, pad, pad);

  return new Promise((resolve, reject) => {
    out.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
};

/**
 * Image clipboard writes need ClipboardItem, which every current browser has;
 * where it's missing the menu simply doesn't offer the copy.
 */
export const canCopyImage = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.ClipboardItem !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';

/**
 * Put a PNG on the clipboard.
 *
 * Takes the blob as a promise and hands it to ClipboardItem unresolved: Safari
 * only allows the write while the click that asked for it is still on the
 * stack, and rendering the image takes longer than that. A browser that won't
 * take a promise gets a second try with the finished blob.
 */
export const copyImage = async (blob: Promise<Blob>): Promise<void> => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch (err) {
    // A failed render is the real error — don't paper over it with a retry.
    const resolved = await blob;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': resolved })]);
    } catch {
      throw err;
    }
  }
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const slug = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Who and when, from whichever of the pages' own query keys this URL carries,
 * so a folder of downloads reads as more than ten copies of "win-probability".
 */
const urlContext = (): string[] => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'compare') {
    const a = params.get('aTeam');
    const b = params.get('bTeam');
    return [a && b ? `${a} vs ${b}` : null, params.get('compareYear')].filter((v): v is string => Boolean(v));
  }
  if (view === 'spTrends') {
    return [params.get('spTeam'), params.get('spTeamB')].filter((v): v is string => Boolean(v));
  }
  return [params.get('team'), params.get('year')].filter((v): v is string => Boolean(v));
};

/**
 * e.g. `alabama-2025-win-probability.png`. Context the title already carries
 * ("Play map: Alabama") isn't repeated.
 */
export const imageFileName = (title: string): string => {
  const titleSlug = slug(title);
  const context = urlContext()
    .map(slug)
    .filter(part => part && !titleSlug.includes(part));
  return `${[...context, titleSlug].filter(Boolean).join('-') || 'chart'}.png`;
};
