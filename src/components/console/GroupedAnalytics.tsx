'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, BarChart, Navigation, Maximize, X } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const HeatmapLayer = dynamic(() => import('@/components/console/HeatmapLayer'), { ssr: false });

import { ReportEntry } from '@/types';
import type { Map as LeafletMap } from 'leaflet';

interface GroupedAnalyticsProps {
  processedCount: number;
  totalQueue: number;
  globalReport: (ReportEntry & { source_file: string })[];
  cartoTileUrl: string;
  mapTheme: string;
}

export default function GroupedAnalytics({ processedCount, totalQueue, globalReport, cartoTileUrl, mapTheme }: GroupedAnalyticsProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [isMapMaximized, setIsMapMaximized] = useState(false);

  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
        // Force leaflet.heat and tiles to redraw since invalidateSize doesn't always trigger moveend
        map.fire('moveend');
      }, 100);
    }
  }, [isMapMaximized, map]);

  useEffect(() => {
    if (isMapMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMapMaximized]);

  useEffect(() => {
    if (!map) return;
    map.scrollWheelZoom.disable();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) map.scrollWheelZoom.enable();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) map.scrollWheelZoom.disable();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [map]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Processed</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{processedCount} <span className="text-sm font-normal text-slate-400">/ {totalQueue}</span></p>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Detections</h3>
          <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{globalReport.length}</p>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Flagged for Review</h3>
          <p className="text-3xl font-bold text-orange-500">{globalReport.filter(r => r.flagged_for_review).length}</p>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Avg Confidence</h3>
          <p className="text-3xl font-bold text-emerald-500">
            {globalReport.length > 0 ? (globalReport.reduce((acc, curr) => acc + curr.confidence, 0) / globalReport.length).toFixed(1) : '0'}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Map Backdrop */}
        <AnimatePresence>
          {isMapMaximized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[41]"
              onClick={() => setIsMapMaximized(false)}
            />
          )}
        </AnimatePresence>

        {/* Global Map */}
        <motion.div 
          layout
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={
            isMapMaximized
              ? "fixed top-[104px] bottom-4 left-4 right-4 md:left-10 md:right-10 md:bottom-10 z-[42] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-2xl"
              : "lg:col-span-2 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[500px] flex flex-col shadow-sm backdrop-blur-sm"
          }
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <MapIcon size={20} className="text-emerald-500" /> Global Heatmap
              <span className="text-xs font-normal text-slate-400 ml-2 hidden sm:inline">(Ctrl + Scroll to zoom)</span>
            </h2>
            <div className="flex items-center gap-2">
              {globalReport && globalReport.length > 0 && (
                <button
                  onClick={() => {
                    if (map && globalReport.length > 0) {
                      const lats = globalReport.map((r) => r.latitude);
                      const lons = globalReport.map((r) => r.longitude);
                      map.fitBounds([
                        [Math.min(...lats), Math.min(...lons)],
                        [Math.max(...lats), Math.max(...lons)]
                      ], { padding: [50, 50], maxZoom: 4 });
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                  title="Recenter Map"
                >
                  <Navigation size={16} className="-ml-[1px] mt-[1px]" />
                </button>
              )}
              <button
                onClick={() => setIsMapMaximized(!isMapMaximized)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                title={isMapMaximized ? "Minimize Map" : "Maximize Map"}
              >
                {isMapMaximized ? <X size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0 relative bg-slate-100 dark:bg-slate-900">
            {globalReport.length > 0 ? (
              <MapContainer 
                ref={setMap}
                key={`global-map-${globalReport.length}`} 
                bounds={[
                  [Math.min(...globalReport.map((r) => r.latitude)), Math.min(...globalReport.map((r) => r.longitude))],
                  [Math.max(...globalReport.map((r) => r.latitude)), Math.max(...globalReport.map((r) => r.longitude))]
                ]} 
                boundsOptions={{ padding: [50, 50], maxZoom: 4 }}
                style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }} 
                className="z-0"
              >
                <TileLayer key={mapTheme} url={cartoTileUrl} attribution='&copy; OpenStreetMap' />
                <HeatmapLayer key={`${mapTheme}-${isMapMaximized}`} theme={mapTheme} points={globalReport.map((entry) => [entry.latitude, entry.longitude, entry.confidence / 100])} />
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm">No geographic data.</div>
            )}
          </div>
        </motion.div>

        {/* Global Ledger */}
        <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[500px] flex flex-col shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100"><BarChart size={20} className="text-blue-500" /> Detections by Category</h2>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {globalReport.length > 0 ? (
              <div className="space-y-3">
                { }
                {Object.entries(
                  globalReport.reduce((acc: Record<string, { count: number, flagged: number }>, curr) => {
                    const cls = curr.image_class.replace(/_/g, ' ');
                    if (!acc[cls]) acc[cls] = { count: 0, flagged: 0 };
                    acc[cls].count++;
                    if (curr.flagged_for_review) acc[cls].flagged++;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1].count - a[1].count).map(([className, stats]) => (
                  <div key={className} className="flex justify-between items-center p-4 rounded-xl border bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm capitalize text-slate-900 dark:text-slate-200">{className}</p>
                        {stats.flagged > 0 && <span className="text-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">{stats.flagged} Flagged</span>}
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{stats.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                No detections yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
