# Claude Code Session History

> **Pending TODOs live in [`TODO.md`](./TODO.md)** — check it for tracked
> follow-up work (e.g. URL routing / shareable state for Team Trends sub-tabs).

## Latest Session Summary (Enhanced Refactoring)

**Main Accomplishment: Enhanced ChartsGrid.tsx Refactoring with Bolt Improvements**
- **Reduced from 1,664 lines to 279 lines** (83% reduction!)
- **Maintained ALL enhanced features** from Bolt.new including improved player stats
- **Preserved exact visual output** with new categorizations

**What Was Created (Enhanced Version):**

1. **`src/utils/chartConfig.ts`** - Enhanced Chart.js setup with improved datalabels configuration from Bolt
2. **`src/utils/chartOptions.ts`** - Advanced chart option configurations with enhanced styling
3. **`src/utils/chartHelpers.ts`** - Enhanced data transformation functions with new player categorization logic  
4. **`src/hooks/useChartData.ts`** - Comprehensive custom hook handling ALL enhanced data processing
5. **Refactored `ChartsGrid.tsx`** - Clean component (279 lines) focused purely on rendering

**Enhanced Features Preserved:**
- **Improved Player Charts** - Better categorization (explosive/successful/other catches/incompletes/interceptions)
- **Enhanced Data Labels** - Better formatting and styling from Bolt improvements
- **Advanced Chart Types** - All chart varieties with enhanced visualizations
- **Better Player Stats** - More detailed breakdowns for rush/pass/receive

**Benefits Achieved:**
- **83% code reduction** while maintaining ALL functionality
- **Modular architecture** - each file has single responsibility
- **Enhanced maintainability** - specific chart logic easily found and modified
- **Reusable components** - utilities can be used across other components
- **Better TypeScript support** - focused modules with clear interfaces
- **Improved testing capability** - individual functions can be unit tested
- **Cleaner git workflow** - focused diffs for future changes

**Performance Improvements:**
- **Faster development** - changes to specific chart types isolated to relevant files
- **Better debugging** - errors localized to specific modules
- **Easier feature additions** - new chart types follow established patterns

**Previous Work Comparison:**
- First refactor: 1,569 → 298 lines (81% reduction)
- Enhanced refactor: 1,664 → 279 lines (83% reduction) 
- **Best of both worlds**: Bolt's enhanced features + clean architecture

**Current State:**
Enhanced codebase with all Bolt improvements working perfectly in modular architecture. Server running at http://localhost:5173/

---

## Development Commands

```bash
# Start development server
npm run dev

# Install dependencies
npm install

# Check TypeScript errors
npm run lint
```

## Project Structure Notes

- Main dashboard component: `src/components/Dashboard.tsx`
- Chart components: `src/components/ChartsGrid.tsx` (recently refactored)
- API services: `src/services/api.ts`, `src/services/boxScoreApi.ts`
- Types: `src/types/index.ts`
- Utilities: `src/utils/` (expanded with chart utilities)
- Hooks: `src/hooks/` (added useChartData.ts)

## Git Workflow

**IMPORTANT**: Do NOT push changes to the main branch (production) without explicit user approval.

- **Always commit changes locally** when work is complete
- **Ask for confirmation before pushing** - e.g., "Ready to push this to production?" or "Should I deploy these changes?"
- **Wait for user approval** before running `git push`
- User will review changes before they go live on production

This ensures the user maintains control over what gets deployed and when.

## Code Review

- **Greptile is the only code reviewer** for this repo. Trigger it with a
  `@greptile review` comment on the PR and iterate to a 5/5 score.
- **CodeRabbit is disabled** — don't trigger it or wait on its reviews.