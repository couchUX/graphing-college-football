# CFB Advanced Analytics Claude Skill

This skill enables Claude to generate ad-hoc college football analytics using the CollegeFootballData.com API. It produces standalone HTML visualizations that match your Graphing College Football app's design and calculation standards.

## What This Skill Does

Generates custom analytics and visualizations for:
- **Single team analysis** - Performance metrics across a season
- **Team comparisons** - Head-to-head or season comparisons
- **Player stats** - Aggregated stats across multiple games
- **Trend analysis** - Performance over time
- **Offense vs Defense** - Team offense vs. opponents' offense (defensive performance)

## Files in This Skill

- **`skill.md`** - Main skill instructions for Claude
- **`api-reference.md`** - CollegeFootballData API documentation
- **`calculation-formulas.md`** - Success rate, explosiveness, player extraction logic
- **`chart-templates.md`** - Chart.js configuration examples
- **`team-colors-reference.md`** - Team color schemes
- **`README.md`** - This file

## How to Use

### 1. Install the Skill

1. Zip this entire folder:
   ```bash
   cd .claude/skills
   zip -r cfb-analysis.zip cfb-analysis/
   ```

2. In Claude.ai, go to Settings → Skills → Upload Skill
3. Upload the `cfb-analysis.zip` file

### 2. Use the Skill

In Claude.ai chat, simply ask for an analysis:

**Examples:**
- "Show me Alabama's 3rd down success rate by quarter for the 2024 season"
- "Compare Ohio State and Michigan's red zone performance in 2024"
- "What are Jalen Milroe's passing stats across the 2024 season?"
- "Show me Georgia's success rate trend game-by-game in 2024"
- "Analyze Texas' offense vs defense performance in 2024"

Claude will generate a complete HTML file with:
- Interactive Chart.js visualization
- Team colors
- Summary statistics
- Save as PNG button
- Data attribution

### 3. View the Analysis

Claude will provide the complete HTML code. To use it:

1. Copy the HTML code
2. Save it as a `.html` file (e.g., `alabama-analysis.html`)
3. Open in your browser
4. Click "Save as PNG" to export the chart

## Maintaining This Skill

### When to Update

Update the skill when you:
- Change calculation formulas in `src/utils/metrics.ts`
- Add new team color overrides in `src/utils/displayTeamColors.ts`
- Modify chart styling in your app
- Want to add new analysis types

### How to Update

1. **Edit the relevant files** in `.claude/skills/cfb-analysis/`
   - Update formulas in `calculation-formulas.md`
   - Add new chart templates to `chart-templates.md`
   - Update API patterns in `api-reference.md`

2. **Re-zip the folder**:
   ```bash
   cd .claude/skills
   zip -r cfb-analysis.zip cfb-analysis/
   ```

3. **Re-upload to Claude.ai**:
   - Go to Settings → Skills
   - Delete old version
   - Upload new `cfb-analysis.zip`

### Quick Updates

For small changes, you can also:
1. Edit files directly in Claude Code
2. Commit changes to git
3. Re-zip and upload when convenient

## Key Concepts

### Multi-Game Analysis

When analyzing multiple games, the skill:
1. Fetches all games for a team in a season
2. Loops through each game to get play-by-play data
3. Aggregates all plays
4. Calculates metrics across the entire dataset
5. Includes both team offense AND opponents' offense (defensive performance)

### Offense vs. Defense

For comprehensive team analysis:
- **Team Offense** = Plays where team has possession
- **Team Defense** = Plays where opponents have possession (opponents' offense)
- Shows both metrics side-by-side for complete picture

### Team Colors

Colors are fetched from the CollegeFootballData API and processed to create:
- Success color (lighter, 0.7 alpha)
- Explosive color (darker, full opacity)
- Light color (very light, 0.2 alpha)

### Rate Limiting

The skill includes 100ms delays between API calls to respect rate limits (200 requests/hour on free tier).

## Example Outputs

### Alabama 3rd Down Analysis
```html
<!DOCTYPE html>
<html>
  <!-- Complete standalone HTML with Chart.js -->
  <!-- Shows 3rd down SR by quarter -->
  <!-- Includes save button -->
</html>
```

### Team Comparison
```html
<!-- Side-by-side bars comparing two teams -->
<!-- Uses both teams' colors -->
<!-- NCAA average reference line -->
```

### Player Stats
```html
<!-- Horizontal stacked bars -->
<!-- Explosive/Successful/Unsuccessful breakdown -->
<!-- Top 10 players -->
```

## Troubleshooting

### "Failed to fetch data"
- Check API endpoint in `api-reference.md`
- Verify team name spelling matches API
- Check rate limits (max 200 requests/hour)

### "Chart not rendering"
- Ensure Chart.js CDN links are included
- Check browser console for errors
- Verify data format matches chart type

### "Colors look wrong"
- Check if team exists in `team-colors-reference.md`
- Verify API team color format
- Update color mapping if needed

## Version Control

This skill is part of your git repository:
```bash
# Stage changes
git add .claude/skills/cfb-analysis/

# Commit with descriptive message
git commit -m "Update CFB analysis skill: add new metric"

# Push to remote
git push
```

## Future Enhancements

Potential additions to consider:
- EPA (Expected Points Added) calculations
- Play type analysis (RPO, screen, etc.)
- Situational splits (time of day, home/away)
- Drive analysis (scoring drives, 3-and-outs)
- Advanced player metrics (yards after contact, etc.)

## Support

For questions or issues:
1. Check this README
2. Review the source files in `src/utils/`
3. Consult the main app's CLAUDE.md
4. Test in the local app first before adding to skill

## Credits

This skill uses data from [CollegeFootballData.com](https://collegefootballdata.com) and generates visualizations using [Chart.js](https://www.chartjs.org/).
