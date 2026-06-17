# OperationsClock Component

A configurable interval-based time control interface designed for operations mode in MMGIS. Provides quick access to time ranges with a flexible multi-button interface.

## Overview

The OperationsClock component displays configurable interval buttons for time range selection:

- **Past interval buttons** - Multiple past time range buttons (e.g., "-2", "-1 week")
- **today** - Current day button (always 1 day, midnight to midnight)
- **Future interval buttons** - Multiple future time range buttons (e.g., "+1 week", "+2")

The number of buttons on each side is configurable (0-10), allowing for flexible time navigation suited to your mission's needs.

## Features

- ✅ **Configurable Interval Buttons**: Multiple past/future buttons with customizable counts
- ✅ **Custom Date Selection**: Click today button to select any date via date picker
- ✅ **Tippy.js Tooltips**: Hover over buttons to see exact date and time ranges
- ✅ **Fixed Position**: Always visible at bottom center of screen
- ✅ **Flexible Units**: Independent past and future time units (hour, day, week, month)
- ✅ **TimeControl Integration**: Seamlessly works with MMGIS time system
- ✅ **Mobile Responsive**: Adapts to smaller screens with dropdown mode

## UI Layout

**Desktop (with pastInterval=2, futureInterval=2):**
```
  -2    -1 week    today    +1 week    +2
```

**Mobile:** Dropdown selectors for past/future intervals with today section in the middle.

**Active button** is highlighted with white background and black text.
**Tooltips** show exact date and time ranges on hover using Tippy.js (e.g., "1/12/2026 → 1/25/2026").

## Configuration Options

Configure via Configure page → Components tab → OperationsClock:

### Time Range Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Past Interval Count** | Number (0-10) | `0` | Number of past interval buttons to display |
| **Future Interval Count** | Number (0-10) | `0` | Number of future interval buttons to display |
| **Past Unit** | Dropdown | `week` | Time unit for past intervals (used for -1 button label) |
| **Future Unit** | Dropdown | `week` | Time unit for future intervals (used for +1 button label) |

**Available Units**: `hour`, `day`, `week`, `month`

### Display Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Tooltip Refresh Interval** | Number (60-86400) | `3600` | Seconds between tooltip updates |

## Time Range Logic

### today Button (offset = 0)
- **Always represents the current day** (or custom selected date)
- Start: Selected day at 00:00:00
- End: Selected day at 23:59:59
- Example (1/26/2026): Sets time to 1/26/2026 00:00:00 - 1/26/2026 23:59:59
- **Click when active**: Opens date picker to select custom date

### Past Interval Buttons (offset = -1, -2, etc.)
- **Each button represents one unit of time in the past**
- For -1 with pastUnit=week: Shows previous week (7 days before today)
- For -2 with pastUnit=week: Shows 2 weeks before today (14 days before)
- Range duration equals one unit (e.g., 1 week = 7 days)
- Example (-1, pastUnit=week, today=1/26/2026):
  - Sets time to 1/19/2026 00:00:00 - 1/25/2026 23:59:59

### Future Interval Buttons (offset = +1, +2, etc.)
- **Each button represents one unit of time in the future**
- For +1 with futureUnit=week: Shows next week (7 days after today)
- For +2 with futureUnit=week: Shows 2 weeks after today (14 days after)
- Range duration equals one unit (e.g., 1 week = 7 days)
- Example (+1, futureUnit=week, today=1/26/2026):
  - Sets time to 1/27/2026 00:00:00 - 2/2/2026 23:59:59

## Usage

### Basic Setup

1. **Build the project** to register the component:
   ```bash
   npm run build
   ```

2. **Open Configure page** (`/configure`)

3. **Navigate to Components tab**

4. **Find and enable OperationsClock**

5. **Configure time ranges**:
   - Set past interval count (e.g., `2` for two past buttons)
   - Set future interval count (e.g., `2` for two future buttons)
   - Set past unit (e.g., `week` for weekly intervals)
   - Set future unit (e.g., `week` for weekly intervals)
   - Adjust refresh interval as needed

6. **Save mission configuration**

7. **Open mission** - OperationsClock appears at bottom center

### Typical Operations Setup

For operations missions, it's recommended to:

1. **Hide TimeUI tool** in mission configuration
   - Prevents operators from manually adjusting time
   - Reduces interface complexity

2. **Enable OperationsClock component**
   - Provides controlled time interface
   - Ensures consistent time state across team

3. **Configure appropriate ranges**:
   - **Recent Operations**: pastInterval=2, futureInterval=2, pastUnit=`week`, futureUnit=`week`
   - **Daily Operations**: pastInterval=3, futureInterval=3, pastUnit=`day`, futureUnit=`day`
   - **Monthly Planning**: pastInterval=1, futureInterval=2, pastUnit=`month`, futureUnit=`week`

### Using the Buttons

**today Button** (default active):
- Click to set time range to current day only (or custom selected date)
- Shows today from midnight to midnight
- **Click again when active** to open date picker for custom date selection
- Custom date display shows "Back to Today" link to reset

**Past Interval Buttons** (-1, -2, etc.):
- Click to view past time ranges
- Example: With pastUnit=`week`, -1 shows last week, -2 shows 2 weeks ago
- Each button represents one unit of time in the past

**Future Interval Buttons** (+1, +2, etc.):
- Click to view future time ranges
- Example: With futureUnit=`week`, +1 shows next week, +2 shows 2 weeks ahead
- Each button represents one unit of time in the future

**Button switching is immediate** - no confirmation required for fast operations workflow.

### Viewing Date Ranges

**Hover over any interval button** to see the exact date range in the Tippy.js tooltip:
- Date format: M/D/YYYY (e.g., "1/26/2026 → 2/2/2026")
- Shows start date → end date
- Updates automatically based on current or custom selected date

## Technical Details

### TimeControl Integration

OperationsClock uses MMGIS's TimeControl system with absolute time format:

```javascript
// Example: Set time to a day offset range
const range = this.getOffsetRange(offset)
TimeControl.setTime(
    TimeControl.timeUI.removeOffset(range.start.getTime()),
    TimeControl.timeUI.removeOffset(range.end.getTime()),
    false,         // isRelative = false (absolute times)
    '00:00:00'     // No time offset
)
```

### Subscription to Time Changes

The component subscribes to TimeControl updates:

```javascript
TimeControl.subscribe('operationsClock', (timeData) => {
    // Updates tooltips when time changes from other sources
})
```

### Tooltip Update Mechanism

Tooltip dates refresh at configured interval:

```javascript
setInterval(() => {
    updateTooltips()  // Refresh tooltip date ranges
}, liveRefreshInterval * 1000)
```

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Dependencies

- **TimeControl**: Required for time management

Component will log error and fail gracefully if TimeControl is not available.

## Limitations

- **Fixed interval counts**: Maximum 10 buttons per side
- **Single unit type**: Past and future buttons each use one unit type (can't mix days and weeks)
- **No draggable timeline**: Buttons only (by design for simplicity)
- **Always visible**: No minimize/hide option (by design for awareness)
- **Today is always 1 day**: The today button always represents a single day (not configurable)

## Troubleshooting

### Component doesn't appear

**Solution**:
1. Ensure you ran `npm run build` after creating the component
2. Check Configure > Components tab - is OperationsClock enabled?
3. Check browser console for errors

### Clicking buttons doesn't change time

**Solution**:
1. Check browser console for TimeControl errors
2. Verify mission has time-enabled layers
3. Test with TimeUI visible to confirm TimeControl is working
4. Check for JavaScript errors in console

### Tooltips show wrong dates

**Solution**:
1. Check system clock is correct
2. Check browser timezone settings
3. Wait for next tooltip refresh (default: 1 hour)
4. Reduce refresh interval in configuration for more frequent updates

## Best Practices

### For Mission Operators

1. **Use [today] button** for reviewing current day's data
2. **Use past interval buttons** (-1, -2, etc.) for historical context
3. **Use future interval buttons** (+1, +2, etc.) for planning upcoming activities
4. **Click today when active** to select a custom date for analysis
5. **Hover over interval buttons** to see exact date ranges before clicking

### For Mission Admins

1. **Set realistic time ranges** based on mission cadence
2. **Use longer refresh intervals** (3600s = 1 hour) to reduce processing
3. **Hide TimeUI** to simplify operator interface
4. **Test time ranges** before operations begin
5. **Document time conventions** for team

## Example Configurations

### Mars Rover Operations (Weekly View)
```json
{
  "pastInterval": 2,
  "futureInterval": 2,
  "pastUnit": "week",
  "futureUnit": "week",
  "liveRefreshInterval": 3600
}
```
**Buttons**: `[-2]` `[-1 week]` `[today]` `[+1 week]` `[+2]`
**Use case**: Review past 2 weeks, see today, plan next 2 weeks

### Daily Mission Planning
```json
{
  "pastInterval": 3,
  "futureInterval": 3,
  "pastUnit": "day",
  "futureUnit": "day",
  "liveRefreshInterval": 1800
}
```
**Buttons**: `[-3]` `[-2]` `[-1 day]` `[today]` `[+1 day]` `[+2]` `[+3]`
**Use case**: See 3 days before, today, and 3 days ahead

### Monthly Overview
```json
{
  "pastInterval": 1,
  "futureInterval": 1,
  "pastUnit": "month",
  "futureUnit": "month",
  "liveRefreshInterval": 7200
}
```
**Buttons**: `[-1 month]` `[today]` `[+1 month]`
**Use case**: Review last month, see today, plan next month

### Today Only
```json
{
  "pastInterval": 0,
  "futureInterval": 0,
  "pastUnit": "day",
  "futureUnit": "day",
  "liveRefreshInterval": 3600
}
```
**Buttons**: `[today]`
**Use case**: Simple today-only view with custom date selection

## Support

For issues or questions about OperationsClock:

1. Check this README for configuration guidance
2. Review browser console for error messages
3. Verify TimeControl is functioning properly
4. Test with other time components to confirm system works

## Changelog

### Version 3.0.0 (2026-02-17)
- **Breaking change**: Removed legacy mode support
- Now always uses interval-based button system
- Configurations with both pastInterval=0 and futureInterval=0 now show only today button
- Simplified codebase by removing ~300+ lines of legacy-specific code
- All existing interval mode functionality preserved
- No breaking changes for missions already using interval mode

### Version 2.0.0 (2026-01-26)
- Added day intervals mode with configurable button counts
- Added custom date picker for today button
- Added mobile dropdown mode
- Added "Back to Today" functionality
- Maintained backward compatibility with legacy three-button mode

### Version 1.0.0 (2026-01-15)
- Initial release
- Three-button interface (past/today/forecast)
- Configurable time units
- Tippy.js tooltips
