

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
  disabled?: boolean;
  /** Shown as a quiet note beside a disabled tab, e.g. "Soon". */
  note?: string;
}

interface SubTabsProps<T extends string> {
  items: SubTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

/**
 * Within-page view switcher, set as underlined text tabs so it echoes the
 * masthead nav instead of introducing a second button language.
 */
function SubTabs<T extends string>({ items, value, onChange, label, className = '' }: SubTabsProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-5 border-b border-hairline ${className}`} role="tablist" aria-label={label}>
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
            className={`relative -mb-px flex items-center gap-1.5 pb-2.5 pt-1 text-[15px] font-medium transition-colors ${
              item.disabled
                ? 'cursor-not-allowed text-neutral-400'
                : isActive
                  ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:content-[""]'
                  : 'text-byline hover:text-ink'
            }`}
          >
            {item.label}
            {item.note && (
              <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                {item.note}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SubTabs;
