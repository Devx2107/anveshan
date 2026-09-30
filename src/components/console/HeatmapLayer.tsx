'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    let heatLayer: L.Layer | null = null;

    if (typeof window !== 'undefined') {
      // leaflet.heat requires global L
      (window as typeof window & { L: typeof L }).L = L;

      import('leaflet.heat').then(() => {
        if (!points || points.length === 0) return;

        heatLayer = L.heatLayer(points, {
          radius: 20,
          blur: 15,
          maxZoom: 4,
          max: 8.0,
          gradient: { 0.1: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' }
        }).addTo(map);
      });
    }

    return () => {
      if (heatLayer && map) {
        map.removeLayer(heatLayer);
      }
    };
  }, [map, points]);

  return null;
}
