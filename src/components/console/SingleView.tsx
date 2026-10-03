'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, AlertTriangle, MapIcon, BarChart, CheckCircle, LocateFixed } from 'lucide-react';
import { QueueItem } from '@/types';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

interface SingleViewProps {
  activeItem: QueueItem | undefined;
  mapTheme: string;
  cartoTileUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leafletLib: any;
}

export default function SingleView({ activeItem, mapTheme, cartoTileUrl, leafletLib }: SingleViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (activeItem && canvasRef.current) {
      if (activeItem.status !== 'done' || !activeItem.data || !activeItem.data.cleaned_image) {
        // Clear canvas if not done
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        return;
      }

      const activeData = activeItem.data;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (activeData.report) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeData.report.forEach((d: any) => {
            const bbox = d.bbox || d.bbox_px;
            if (!bbox) return; // safety check
            const [x, y, w, h] = bbox;
            const flagged = d.flagged_for_review;

            ctx.strokeStyle = flagged ? '#f97316' : '#10b981';
            ctx.lineWidth = 3;
            if (flagged) {
              ctx.setLineDash([8, 6]);
            } else {
              ctx.setLineDash([]);
            }

            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = 'bold 13px Inter, sans-serif';
            const label = `${d.image_class?.replace(/_/g, ' ') || 'Unknown'} ${d.confidence?.toFixed(0) || 0}%`;
            const textMetrics = ctx.measureText(label);
            ctx.fillRect(x, Math.max(0, y - 24), textMetrics.width + 12, 24);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x + 6, Math.max(16, y - 8));
          });
        }
      };
      img.src = `data:image/png;base64,${activeData.cleaned_image}`;
    }
  }, [activeItem]);

  if (!activeItem) {
    return (
      <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center p-8">
        <Loader2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
        <div className="text-slate-600 dark:text-slate-400 font-medium text-lg">No Selection</div>
        <p className="text-xs text-slate-500">Click &quot;Start Batch Processing&quot; to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
        {activeItem.status === 'pending' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center p-8">
            <Loader2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
            <div className="text-slate-600 dark:text-slate-400 font-medium text-lg">Ready to Analyze</div>
            <p className="text-xs text-slate-500">Click &quot;Start Batch Processing&quot; to begin.</p>
          </div>
        )}

        {activeItem.status === 'processing' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
            <div className="text-slate-600 dark:text-slate-300 font-medium">Analyzing Image...</div>
          </div>
        )}

        {activeItem.status === 'error' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
            <div className="text-red-700 dark:text-red-400 font-medium mb-1">Analysis Failed</div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 max-w-md text-center">{activeItem.error}</p>
          </div>
        )}

        {activeItem.status === 'done' && activeItem.data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Raw Input</h3>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeItem.previewUrl} alt="Raw" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Detections</h3>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center relative">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meta Info (Map + Ledger) */}
      {activeItem.status === 'done' && activeItem.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Map View */}
          <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <MapIcon size={18} className="text-emerald-500" /> Geolocation
              </h2>
              {activeItem.data.report && activeItem.data.report.length > 0 && (
                <button
                  onClick={() => {
                    if (map) {
                      map.setView([activeItem.data.report[0].latitude, activeItem.data.report[0].longitude], 4);
                    }
                  }}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                  title="Recenter Map"
                >
                  <LocateFixed size={16} />
                </button>
              )}
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0 relative">
              {activeItem.data.report && activeItem.data.report.length > 0 ? (
                <MapContainer ref={setMap} key={`map-${activeItem.id}`} center={[activeItem.data.report[0].latitude, activeItem.data.report[0].longitude]} zoom={4} style={{ height: '100%', minHeight: '300px', width: '100%' }} className="z-0">
                  <TileLayer key={mapTheme} url={cartoTileUrl} attribution='&copy; OpenStreetMap' />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {activeItem.data.report.map((entry: any) => {
                    const iconHtml = entry.flagged_for_review
                      ? '<div style="background-color:#f97316; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
                      : '<div style="background-color:#10b981; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>';
                    const customIcon = leafletLib ? leafletLib.divIcon({ html: iconHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) : undefined;
                    return (
                      <Marker key={entry.detection_id} position={[entry.latitude, entry.longitude]} icon={customIcon}>
                        <Popup><div className="font-semibold capitalize text-slate-900">{entry.image_class.replace(/_/g, ' ')}</div><div className="text-slate-600">{entry.confidence.toFixed(1)}%</div></Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm">No geographic data.</div>
              )}
            </div>
          </div>

          {/* Ledger */}
          <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[400px]">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100"><BarChart size={18} className="text-blue-500" /> Detection Ledger</h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeItem.data.report && activeItem.data.report.length > 0 ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {activeItem.data.report.map((entry: any) => (
                    <div key={entry.detection_id} className={`flex justify-between items-center px-4 py-2.5 rounded-lg border ${entry.flagged_for_review ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20'}`}>
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-200 capitalize">{entry.image_class.replace(/_/g, ' ')}</p>
                        <span className="text-[10px] font-mono text-slate-500 leading-none">{entry.detection_id}</span>
                      </div>
                      <div className="font-mono text-lg font-semibold text-slate-800 dark:text-slate-100">{entry.confidence.toFixed(0)}<span className="text-xs text-slate-500 font-normal">%</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-slate-50 dark:bg-slate-900/30">
                  <CheckCircle size={32} className="text-emerald-500/50 mb-3" />
                  <p className="font-medium text-slate-700 dark:text-slate-300">All Clear</p>
                  <p className="mt-1 text-center">No targets detected matching the anomaly threshold.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
