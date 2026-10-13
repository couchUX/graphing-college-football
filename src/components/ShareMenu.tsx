import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { Menu } from '@headlessui/react';
import { Check, Code, Download, Image as ImageIcon, Link as LinkIcon, Loader2, Share, type LucideIcon } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { track } from '../utils/analytics';
import { canCopyImage, copyImage, downloadBlob, imageFileName, renderCardImage } from '../utils/shareImage';
import { SHARE_CARD_ATTR, cardLink } from '../utils/shareLink';

type ShareAction = 'embed' | 'copy_image' | 'download_image' | 'link';
type Status = 'idle' | 'busy' | 'done';

interface ShareMenuProps {
  /** The card's title: labels the button and names the downloaded image. */
  title: string;
  /** Builds the card's embed HTML. Omit for a card that has no embed. */
  getEmbedCode?: () => string;
  /** Runs once the embed is on the clipboard (page-specific analytics). */
  onEmbedCopied?: () => void;
  /** E.g. while the card's data is still loading. */
  disabled?: boolean;
  /** Placement within the header, e.g. `ml-auto`. */
  className?: string;
}

/** Breathing room between the button and the menu, and the menu and the viewport edge. */
const GAP = 6;
const EDGE = 8;

/**
 * Fixed-position layer for the open menu, portalled to <body>.
 *
 * Several cards clip their contents (`overflow-hidden` keeps a table's header
 * fill inside the rounded corners), and an absolutely positioned menu inside
 * one would be cut off at the card's edge. Out here it can't be. It opens
 * below the button, right-aligned to it, and flips above when there's no room.
 */
const MenuLayer: React.FC<{ anchor: React.RefObject<HTMLElement>; children: React.ReactNode }> = ({
  anchor,
  children,
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  // Placed by the layout effect below, which runs before the first paint, so
  // this starting spot is never seen. It must not be `visibility: hidden`:
  // Headless UI focuses the menu as it opens (that's what makes Escape and the
  // arrow keys work), and a hidden element can't take focus.
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', top: 0, left: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const button = anchor.current;
      const layer = layerRef.current;
      if (!button || !layer) return;
      const rect = button.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = layer;
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      const top = below + height > window.innerHeight - EDGE && above > EDGE ? above : below;
      const left = Math.min(Math.max(rect.right - width, EDGE), window.innerWidth - width - EDGE);
      setStyle({ position: 'fixed', top, left });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  return createPortal(
    <div ref={layerRef} style={style} className="z-50">
      {children}
    </div>,
    document.body
  );
};

const itemClass = (active: boolean) =>
  `flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
    active ? 'bg-neutral-100 text-ink' : 'text-neutral-700'
  } disabled:cursor-not-allowed disabled:text-neutral-400`;

/**
 * The share button on a chart card: copy its embed code, copy or download a
 * hi-res image of it, or copy a link straight to it.
 *
 * It finds its card by walking up to the nearest `[data-share-card]`, whose
 * `id` is the deep-link fragment and whose box is what the image captures —
 * so a card needs only those two attributes and this button in its header.
 * The button itself carries `data-share-exclude` and stays out of the image.
 */
const ShareMenu: React.FC<ShareMenuProps> = ({
  title,
  getEmbedCode,
  onEmbedCopied,
  disabled = false,
  className = '',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const busy = status === 'busy';

  useEffect(() => {
    if (status !== 'done') return;
    const timer = window.setTimeout(() => setStatus('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const findCard = (): HTMLElement | null => buttonRef.current?.closest<HTMLElement>(`[${SHARE_CARD_ATTR}]`) ?? null;

  const succeed = (action: ShareAction, card: HTMLElement | null, message: string) => {
    setStatus('done');
    showToast(message);
    track('share_chart', {
      event_category: 'user_interaction',
      share_action: action,
      chart_id: card?.id ?? '',
      chart_title: title,
      page: window.location.pathname,
    });
  };

  const fail = (message: string, err: unknown) => {
    console.error(message, err);
    setStatus('idle');
    showToast(message);
  };

  const handleEmbed = async () => {
    if (!getEmbedCode) return;
    try {
      await navigator.clipboard.writeText(getEmbedCode());
      onEmbedCopied?.();
      succeed('embed', findCard(), `Embed code copied for ${title}`);
    } catch (err) {
      fail('Couldn’t copy the embed code. Please try again.', err);
    }
  };

  const handleLink = async () => {
    const card = findCard();
    if (!card?.id) return;
    try {
      await navigator.clipboard.writeText(cardLink(card.id));
      succeed('link', card, 'Link copied');
    } catch (err) {
      fail('Couldn’t copy the link. Please try again.', err);
    }
  };

  // Not async up to the clipboard call: Safari only allows the write while
  // the click is still being handled, so the image is passed along as a
  // promise and rendered after.
  const handleCopyImage = () => {
    const card = findCard();
    if (!card) return;
    setStatus('busy');
    copyImage(renderCardImage(card))
      .then(() => succeed('copy_image', card, 'Image copied'))
      .catch(err => fail('Couldn’t copy the image. Try Download image instead.', err));
  };

  const handleDownload = async () => {
    const card = findCard();
    if (!card) return;
    setStatus('busy');
    try {
      downloadBlob(await renderCardImage(card), imageFileName(title));
      succeed('download_image', card, 'Image downloaded');
    } catch (err) {
      fail('Couldn’t create the image. Please try again.', err);
    }
  };

  const items: { key: ShareAction; label: string; icon: LucideIcon; onSelect: () => void; show: boolean }[] = [
    { key: 'embed', label: 'Copy embed code', icon: Code, onSelect: handleEmbed, show: Boolean(getEmbedCode) },
    { key: 'copy_image', label: 'Copy image', icon: ImageIcon, onSelect: handleCopyImage, show: canCopyImage() },
    { key: 'download_image', label: 'Download image', icon: Download, onSelect: handleDownload, show: true },
    { key: 'link', label: 'Copy link', icon: LinkIcon, onSelect: handleLink, show: true },
  ];

  const buttonTone = (open: boolean) =>
    status === 'done'
      ? 'border-accent text-accent'
      : disabled
        ? 'cursor-not-allowed border-hairline text-neutral-400'
        : busy
          ? 'cursor-progress border-neutral-300 text-byline'
          : open
            ? 'border-neutral-400 text-ink'
            : 'border-neutral-300 text-byline hover:border-neutral-400 hover:text-ink';

  return (
    <Menu as="div" className={`relative flex-none ${className}`} data-share-exclude>
      {({ open }) => (
        <>
          <Menu.Button
            ref={buttonRef}
            disabled={disabled || busy}
            aria-label={`Share ${title}`}
            aria-busy={busy}
            title={busy ? 'Creating image…' : 'Share'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${buttonTone(open)}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === 'done' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Share className="h-4 w-4" />
            )}
          </Menu.Button>

          {open && (
            <MenuLayer anchor={buttonRef}>
              <Menu.Items
                static
                className="w-52 rounded-md border border-neutral-300 bg-white py-1 shadow-lg focus:outline-none"
              >
                {items
                  .filter(item => item.show)
                  .map(item => (
                    <Menu.Item key={item.key}>
                      {({ active }) => (
                        <button type="button" onClick={item.onSelect} className={itemClass(active)}>
                          <item.icon className="h-4 w-4 flex-none text-byline" aria-hidden="true" />
                          {item.label}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
              </Menu.Items>
            </MenuLayer>
          )}
        </>
      )}
    </Menu>
  );
};

export default ShareMenu;
