# UserInterface React Migration QA Checklist

For each item, test with both `?reactui=false` (jQuery) and `?reactui=true` (React) and confirm identical behavior.

## Layout
- [ ] Top bar displays mission name correctly
- [ ] Top bar search area is functional
- [ ] Left toolbar (40px) displays all tool buttons
- [ ] Tool buttons highlight on hover/active
- [ ] Clicking a tool button opens the tool panel at correct width
- [ ] MMGIS logo displays and links to landing page

## Panel Resizing
- [ ] Dragging map splitter resizes viewer/map panels
- [ ] Dragging globe splitter resizes map/globe panels
- [ ] Dragging tools splitter resizes tools area
- [ ] Panels respect minimum size constraints
- [ ] Splitter chevron buttons collapse/expand panels correctly
- [ ] Splitter labels (Viewer/Map/Globe) display correctly

## Tool Panel
- [ ] Tool panel opens with correct width for each tool
- [ ] Tool panel drag handle resizes panel
- [ ] Tool content renders correctly inside panel
- [ ] Closing tool collapses panel to 0 width
- [ ] Top bar adjusts margin when tool panel opens/closes
- [ ] Expandable tools show drag handle, non-expandable tools hide it

## Tools Wrapper
- [ ] Tools wrapper expands/collapses with animation
- [ ] Tools wrapper height is correct for each tool
- [ ] Tools content renders inside wrapper

## Bottom Bar
- [ ] Copy link button works
- [ ] Screenshot button works
- [ ] Fullscreen toggle works
- [ ] Hotkeys modal opens and displays correctly
- [ ] Settings panel opens
- [ ] Each visibility toggle works:
  - [ ] Top Bar visibility
  - [ ] Toolbars visibility
  - [ ] Scale Bar visibility
  - [ ] Coordinates visibility
  - [ ] Graticule visibility
  - [ ] Miscellaneous visibility
- [ ] Info button works (when configured)
- [ ] Help button works (when configured)

## Viewer/Map/Globe
- [ ] Map renders correctly in map panel
- [ ] Globe renders correctly in globe panel (when enabled)
- [ ] Viewer renders correctly in viewer panel (when enabled)
- [ ] Map controls (zoom, pan) work correctly
- [ ] Globe controls work correctly
- [ ] Viewer toolbar displays correctly

## Panel Percents (Deep Links)
- [ ] `setPanelPercents()` correctly sizes viewer/map/globe
- [ ] `getPanelPercents()` returns correct percentages
- [ ] Deep link panel percents are applied on load
- [ ] Config default panel widths are applied

## Right Panel
- [ ] `openRightPanel(width)` opens the right panel
- [ ] `closeRightPanel()` closes the right panel
- [ ] Coordinates div adjusts position when right panel opens

## Window Resize
- [ ] Browser resize reflows layout correctly
- [ ] Panels maintain proportional sizes after resize
- [ ] Map/globe/viewer invalidate size after resize

## Mission Management
- [ ] Mission swap resets UI correctly
- [ ] Multiple rapid tool switches don't break layout
- [ ] Landing page navigation works correctly

## Mobile
- [ ] Mobile layout activates at correct breakpoint (user agent detection)
- [ ] Mobile tool navigation works
- [ ] Mobile panels display correctly

## Keyboard / Accessibility
- [ ] Tab focus styles appear when Tab is pressed
- [ ] Tab focus styles disappear on mouse click
- [ ] Ctrl/Shift key tracking works correctly
- [ ] Splitter panel collapse buttons are keyboard-accessible

## WebSocket Integration
- [ ] Layer update button appears on WebSocket events
- [ ] Layer update button removal works
- [ ] Disconnected state shows correctly

## Edge Cases
- [ ] Viewer panel can be 0 width (hidden)
- [ ] Globe panel can be 0 width (hidden)
- [ ] All panels at minimum width simultaneously
- [ ] Rapid splitter dragging doesn't cause layout glitches
- [ ] Opening/closing tool panel rapidly doesn't break layout
- [ ] Feature flag toggle via URL parameter works
- [ ] Feature flag toggle via environment variable works
