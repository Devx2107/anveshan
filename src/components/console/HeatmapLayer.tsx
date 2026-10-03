'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function HeatmapLayer({ points, theme = 'light_all' }: { points: [number, number, number][], theme?: string }) {
  const map = useMap();

  useEffect(() => {
    let heatLayer: L.Layer | null = null;

    if (typeof window !== 'undefined') {
      // leaflet.heat requires global L
      (window as typeof window & { L: typeof L }).L = L;

      import('leaflet.heat').then(() => {
        if (!points || points.length === 0) return;

        const isDark = theme === 'dark_all';
        const gradient: { [key: number]: string } = isDark
          ? { 0.2: '#312e81', 0.4: '#3b82f6', 0.6: '#10b981', 0.8: '#f59e0b', 1.0: '#ef4444' } // indigo -> blue -> emerald -> amber -> red
          : { 0.1: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' };

        // Dynamically scale max intensity based on total points
        // Sparse points (e.g. 1-2) get a lower max so they pop, dense points cap at 8.0
        const dynamicMax = Math.max(1.8, Math.min(8.0, points.length / 3));

        heatLayer = L.heatLayer(points, {
          radius: 20,
          blur: 15,
          maxZoom: 4,
          max: dynamicMax,
          gradient
        }).addTo(map);
      });
    }

    return () => {
      if (heatLayer && map) {
        map.removeLayer(heatLayer);
      }
    };
  }, [map, points, theme]);

  return null;
}
