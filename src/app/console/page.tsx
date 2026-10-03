'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';


import GroupedAnalytics from '@/components/console/GroupedAnalytics';
import SingleView from '@/components/console/SingleView';
import Sidebar from '@/components/console/Sidebar';

import { useFileProcessing } from '@/hooks/useFileProcessing';

export default function Dashboard() {
  const router = useRouter();
  const { authenticated, authReady } = useAuth();
  const { resolvedTheme } = useTheme();

  const mapTheme = resolvedTheme === 'dark' ? 'dark_all' : 'light_all';
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${mapTheme}/{z}/{x}/{y}{r}.png${cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : ''}`;

  // State Management
  const { queue, processingStatus, activeViewIndex, setActiveViewIndex, handleFileChange, handleClear, handleRemoveQueueItem, startProcessing, processAddedFiles } = useFileProcessing();
  const [viewMode, setViewMode] = useState<'single' | 'grouped'>('single');


  const [isDragging, setIsDragging] = useState(false);

  // Map icon fix for leaflet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leafletLib, setLeafletLib] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeafletLib(leaflet);
    });
  }, []);

  useEffect(() => {
    if (authReady && !authenticated) {
      router.replace('/login');
    }
  }, [authReady, authenticated, router]);


  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!e.dataTransfer) return;

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traverseFileTree = async (item: any, path: string = '') => {
      return new Promise<void>((resolve) => {
        if (item.isFile) {
          item.file((file: File) => {
            files.push(file);
            resolve();
          });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dirReader.readEntries(async (entries: any[]) => {
            for (const entry of entries) {
              await traverseFileTree(entry, path + item.name + '/');
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    const traversePromises = items.map((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          return traverseFileTree(entry);
        }
      }
      return Promise.resolve();
    });

    await Promise.all(traversePromises);

    if (files.length > 0) {
      processAddedFiles(files);
    }
  };



  // Global Aggregations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalReport: any[] = [];
  queue.forEach(item => {
    if (item.status === 'done' && item.data?.report) {
      item.data.report.forEach((entry: Record<string, unknown>) => {
        globalReport.push({ ...entry, source_file: item.file.name });
      });
    }
  });

  const downloadJson = () => {
    if (globalReport.length === 0) return;
    const blob = new Blob([JSON.stringify(globalReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_batch_report.json';
    a.click();
  };

  const downloadCsv = () => {
    if (globalReport.length === 0) return;
    const headers = Object.keys(globalReport[0]).join(',');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = globalReport.map((r: any) =>
      Object.values(r).map(v => {
        if (typeof v === 'object' && v !== null) {
          return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        }
        if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\\n'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_batch_report.csv';
    a.click();
  };

  if (!authReady || !authenticated) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-transparent text-slate-500 dark:text-slate-400 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </main>
    );
  }

  const activeItem = queue[activeViewIndex];
  const processedCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const pendingCount = queue.filter(q => q.status === 'pending').length;

  return (
    <div
      className="flex-1 bg-transparent text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500/30 flex flex-col transition-colors min-h-screen"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
      }}
    >
      {isDragging && (
        <div
          className="fixed inset-0 z-[100]"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            handleDrop(e);
          }}
        />
      )}

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* Left Column: Upload & Queue */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="xl:col-span-4 space-y-6 flex flex-col"
          >
            <Sidebar 
              queue={queue}
              isDragging={isDragging}
              handleFileChange={handleFileChange}
              handleClear={handleClear}
              processingStatus={processingStatus}
              pendingCount={pendingCount}
              processedCount={processedCount}
              errorCount={errorCount}
              startProcessing={startProcessing}
              viewMode={viewMode}
              setViewMode={setViewMode}
              activeViewIndex={activeViewIndex}
              setActiveViewIndex={setActiveViewIndex}
              handleRemoveQueueItem={handleRemoveQueueItem}
              globalReport={globalReport}
              downloadJson={downloadJson}
              downloadCsv={downloadCsv}
            />

          </motion.div>

          {/* Right Column: Visualization / Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="xl:col-span-8 space-y-6"
          >

            {queue.length === 0 && (
              <div className="h-full w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 transition-colors min-h-[500px]">
                <Layers className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700" />
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Upload Data to Begin</p>
                <p className="text-sm mt-2 max-w-sm text-center">Drag and drop a folder of images, multiple selected images, or a ZIP archive into the upload area.</p>
              </div>
            )}

            {queue.length > 0 && viewMode === 'single' && activeItem && (
              <div className="space-y-6">
                {/* Viewer */}
                <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors">
                  <div className="flex items-center justify-between mb-4 h-8">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate pr-4">
                      <ImageIcon size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{activeItem.file.name}</span>
                    </h2>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border border-slate-200 dark:border-slate-700">
                      <button
                        disabled={activeViewIndex === 0}
                        onClick={() => setActiveViewIndex(prev => prev - 1)}
                        className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed"
                        title="Previous Image"
                      ><ChevronLeft size={16} /></button>
                      <span className="text-xs font-medium px-2 min-w-[40px] text-center text-slate-700 dark:text-slate-300" title="Current Image">{activeViewIndex + 1} / {queue.length}</span>
                      <button
                        disabled={activeViewIndex === queue.length - 1}
                        onClick={() => setActiveViewIndex(prev => prev + 1)}
                        className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed"
                        title="Next Image"
                      ><ChevronRight size={16} /></button>
                    </div>
                  </div>

                  <SingleView 
                    activeItem={activeItem}
                    mapTheme={mapTheme}
                    cartoTileUrl={cartoTileUrl}
                    leafletLib={leafletLib}
                  />
                </div>
              </div>
            )}

            {queue.length > 0 && viewMode === 'grouped' && (
              <GroupedAnalytics 
                processedCount={processedCount}
                totalQueue={queue.length}
                globalReport={globalReport}
                cartoTileUrl={cartoTileUrl}
                mapTheme={mapTheme}
              />
            )}

          </motion.div>

        </div>
      </main>
    </div>
  );
}
