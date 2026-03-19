# Analysis Tool

The Analysis Tool provides interactive data visualization and statistical analysis capabilities for MMGIS layers using ECharts.

## Overview

This tool enables users to create interactive charts and perform statistical analysis on layer data directly within MMGIS. It supports various chart types and real-time data exploration.

## Planned Features

### Interactive Charts
- **Line Charts**: Time series data and trend analysis
- **Bar Charts**: Categorical data comparison
- **Scatter Plots**: Correlation analysis between variables
- **Histograms**: Data distribution visualization
- **Box Plots**: Statistical summary visualization

### Data Analysis
- Statistical summaries (mean, median, mode, std deviation)
- Correlation analysis between layer attributes
- Data filtering and aggregation
- Temporal analysis for time-enabled layers

### Export Options
- Save charts as PNG, JPG, or SVG images
- Export data as CSV or JSON
- Copy chart configurations for sharing

### Real-time Updates
- Charts automatically update based on map interactions
- Dynamic filtering based on map extent
- Layer visibility changes reflect in charts

## Usage

1. **Select Data Source**: Choose from available layers and their attributes
2. **Choose Chart Type**: Select the appropriate visualization for your data
3. **Configure Chart**: Customize appearance, colors, and styling
4. **Analyze**: Interact with the chart to explore data patterns
5. **Export**: Save your charts or data for external use

## Current Status

This is a boilerplate implementation. The tool interface is ready for ECharts integration and future development of the analysis features described above.

## Technical Details

- **Visualization Library**: ECharts (Apache ECharts)
- **Panel Type**: Left-side expandable panel
- **Data Sources**: MMGIS layer attributes and features
- **Integration**: Real-time connection with map interactions