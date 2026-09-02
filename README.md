# SIH 26143 — Maritime Situation & Oil Spill Intelligence Platform

Geospatial intelligence platform for maritime monitoring, SAR radar detection, oil slick segmentation, time-animated H3 corridor matching, and AIS vessel tracks.

## Features (Day 2 Integration)

1. **MapLibre GL & Deck.gl Map Dashboard**: High-contrast, dark maritime base map of Singapore Strait with interactive zoom, pitch, and bearing controls.
2. **SAR Raster Overlay**: Synthetic Aperture Radar Sentinel-1 backscatter scene integration with live opacity control.
3. **Oil Slick Polygon**: High-confidence oil slick extent polygon with forensic classification metadata.
4. **Time-Animated H3 Hexagonal Corridor**: Dynamic H3 density corridor adapting in real-time across observation timestamps (`-24h → -18h → -12h → -6h → 0h`) using particle density color gradients.
5. **AIS Vessel Tracks Overlay**: Vessel historical trajectories and interpolated position pings mapped to observation timestamps.
6. **Observation Time Slider**: Interactive timeline scrubber with Play Demo animation, milestone snaps, and live UTC clock.
7. **Clean Pipeline Adapters**: Standardized data contracts for cross-pipeline data injection (P1, P4, P5).

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build
```
