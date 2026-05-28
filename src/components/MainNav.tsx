import type React from 'react';
import { BarChart3, Award, TrendingUp, Sparkles, type LucideIcon } from 'lucide-react';

export type MainNavId = 'games' | 'ratings' | 'trends' | 'discover';

interface NavItem {
  id: MainNavId;
  label: string;
  href: string;
  title: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'games', label: 'Games', href: '/games', title: 'Games', Icon: BarChart3 },
  { id: 'ratings', label: 'Ratings', href: '/ratings', title: 'SP+ Ratings', Icon: Award },
  { id: 'trends', label: 'Trends', href: '/trends', title: 'Team Trends', Icon: TrendingUp },
  { id: 'discover', label: 'Discover', href: '/discover', title: 'Discover', Icon: Sparkles },
];

interface MainNavProps {
  current: MainNavId;
}

const MainNav = ({ current }: MainNavProps) => {
  const handleMobileNav = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const item = NAV_ITEMS.find((nav) => nav.id === event.target.value);
    if (item && item.id !== current) {
      window.location.href = item.href;
    }
  };

  return (
    <>
      {/* Mobile: full-width dropdown */}
      <select
        value={current}
        onChange={handleMobileNav}
        aria-label="Navigate to page"
        className="sm:hidden w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {NAV_ITEMS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      {/* Desktop: segmented control */}
      <div className="hidden sm:flex border border-neutral-300 rounded-lg overflow-hidden h-10">
        {NAV_ITEMS.map((item, index) => {
          const isActive = item.id === current;
          return (
            <a
              key={item.id}
              href={item.href}
              title={item.title}
              className={`flex items-center justify-center gap-2 px-3 text-sm font-medium transition-colors ${
                index > 0 ? 'border-l border-neutral-300' : ''
              } ${
                isActive
                  ? 'bg-neutral-200 text-neutral-600 cursor-default'
                  : 'bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <item.Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
    </>
  );
};

export default MainNav;
