export type MainNavId = 'games' | 'ratings' | 'trends' | 'discover';

interface NavItem {
  id: MainNavId;
  label: string;
  href: string;
  title: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'games', label: 'Games', href: '/games', title: 'Games' },
  { id: 'ratings', label: 'Ratings', href: '/ratings', title: 'SP+ ratings' },
  { id: 'trends', label: 'Trends', href: '/trends', title: 'Team trends' },
  { id: 'discover', label: 'Discover', href: '/discover', title: 'Discover' },
];

interface MainNavProps {
  current: MainNavId;
}

/**
 * Section navigation as underlined text tabs — the masthead treatment, so it
 * reads as a publication's sections rather than an app's button group. Short
 * labels mean the same row works from 390px up; no mobile dropdown needed.
 */
const MainNav = ({ current }: MainNavProps) => (
  <nav aria-label="Sections">
    <ul className="flex items-center gap-5 sm:gap-6">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === current;
        return (
          <li key={item.id}>
            <a
              href={item.href}
              title={item.title}
              aria-current={isActive ? 'page' : undefined}
              className={`relative block py-1 text-[15px] font-medium transition-colors ${
                isActive
                  ? 'text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-accent after:content-[""]'
                  : 'text-byline hover:text-ink'
              }`}
            >
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default MainNav;
