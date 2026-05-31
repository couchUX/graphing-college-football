import { Listbox } from '@headlessui/react';
import { BarChart3, Award, TrendingUp, Sparkles, ChevronDown, type LucideIcon } from 'lucide-react';

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
  const currentItem = NAV_ITEMS.find((item) => item.id === current) ?? NAV_ITEMS[0];

  const handleSelect = (id: MainNavId) => {
    const item = NAV_ITEMS.find((nav) => nav.id === id);
    if (item && item.id !== current) {
      window.location.href = item.href;
    }
  };

  return (
    <>
      {/* Mobile: full-width dropdown with icons */}
      <div className="sm:hidden w-full">
        <Listbox value={current} onChange={handleSelect}>
          <div className="relative">
            <Listbox.Button className="relative w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <span className="flex items-center gap-2">
                <currentItem.Icon className="h-5 w-5 text-neutral-600" />
                <span className="block truncate text-sm font-medium text-neutral-700">
                  {currentItem.label}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              {NAV_ITEMS.map((item) => (
                <Listbox.Option
                  key={item.id}
                  value={item.id}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                      active ? 'bg-blue-100 text-blue-900' : 'text-neutral-900'
                    }`
                  }
                >
                  {({ selected }) => (
                    <span className="flex items-center gap-2">
                      <item.Icon className="h-5 w-5 text-neutral-600" />
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                        {item.label}
                      </span>
                    </span>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
      </div>

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
