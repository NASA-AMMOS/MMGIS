---
layout: page
title: Time
permalink: /configure/tabs/time
parent: Tabs
grand_parent: Configure
---

# Time Tab

## User Interface

### Enabled

This enables the user interface for Time. If disabled, global time will not be used

### Visible

Whether or not the Time user interface should be visible. This allows time to be enabled while restricting users from using its UI.

### Initially Open

If enabled and visible, the Time UI will be initially open on the bottom of the screen.

## Time Format

The time format to be displayed on the Time UI. Uses D3 time format specifiers: https://github.com/d3/d3-time-format

Default: `%Y-%m-%dT%H:%M:%SZ`

## Initial Start Time

The initial start time. Should be before `Initial End Time`.

Default: 1 month before `Initial End Time`

## Initial End Time

The initial end time. Should be after `Initial Start Time`. Use `now` to have the end time be the present.

Default: `now`

## Initial Window Start Time

This does not control the time range for queries. This only allows the initial time window of the time line to differ from just being the Start Time to the End Time. A use-case for this would be to set the window times to fit the full extent of the temporal data but only set the Initial Start and End Times as a subset of that so as not to query everything on load.

Default: `Initial Start Time`

## Initial Window End Time

This does not control the time range for queries. This only allows the initial time window of the time line to differ from just being the Start Time to the End Time. Should be after `Initial Window End Time` Use `now` to have the end time be the present.

Default: `Initial End Time`
