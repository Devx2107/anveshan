'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FolderArchive, Play, Loader2, CheckCircle, Trash2, XCircle, Download, FileJson, FileSpreadsheet, Clock } from 'lucide-react';
import { QueueItem, ViewMode } from '@/types';

interface SidebarProps {
  queue: QueueItem[];
  isDragging: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
  processingStatus: 'idle' | 'processing' | 'done';
  pendingCount: number;
  processedCount: number;
  errorCount: number;
  startProcessing: (retryFailed: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeViewIndex: number;
  setActiveViewIndex: (idx: number) => void;
  handleRemoveQueueItem: (id: string, e: React.MouseEvent) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalReport: any[];
  downloadJson: () => void;
  downloadCsv: () => void;
}

export default function Sidebar({
  queue,
  isDragging,
  handleFileChange,
  handleClear,
  processingStatus,
  pendingCount,
  processedCount,
  errorCount,
  startProcessing,
  viewMode,
  setViewMode,
  activeViewIndex,
  setActiveViewIndex,
  handleRemoveQueueItem,
  globalReport,
  downloadJson,
  downloadCsv
}: SidebarProps) {
  return (
    <>
      <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors">
        <div className="flex justify-between items-center mb-4 h-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UploadCloud size={20} className="text-cyan-600 dark:text-cyan-400" /> Upload Files
          </h2>
          {queue.length > 0 && processingStatus !== 'processing' && (
            <button onClick={handleClear} className="p-2 bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors" title="Clear All Files">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Drag and drop area */}
        <div
          role="button"
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
            ${isDragging ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-400/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
        >
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/png, image/jpeg, application/zip"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            id="folder-upload"
            type="file"
            // @ts-expect-error webkitdirectory is a non-standard property
            webkitdirectory="true"
            onChange={handleFileChange}
            className="hidden"
          />

          <FolderArchive className="w-10 h-10 text-slate-400 mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Drag and drop folders, images, or ZIPs here</p>

          <div className="flex gap-3 mb-2">
            <button
              onClick={() => document.getElementById('file-upload')?.click()}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm z-10"
            >
              Browse Files
            </button>
            <button
              onClick={() => document.getElementById('folder-upload')?.click()}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm z-10"
            >
              Browse Folder
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Extracts all PNG/JPG files automatically</p>
        </div>

        {queue.length > 0 && (
          <div className="mt-6">
            {pendingCount > 0 && processingStatus !== 'processing' && (
              <button
                onClick={() => startProcessing(false)}
                className="w-full bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Play size={18} /> {processedCount > 0 || errorCount > 0 ? 'Resume Processing' : 'Start Batch Processing'}
              </button>
            )}

            {pendingCount === 0 && errorCount > 0 && processingStatus !== 'processing' && (
              <button
                onClick={() => startProcessing(true)}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Play size={18} /> Retry Failed
              </button>
            )}

            {processingStatus === 'processing' && (
              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 h-[48px] flex flex-col justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5"><Loader2 size={10} className="animate-spin text-cyan-500" /> Processing</span>
                  <span>{Math.round(((processedCount + errorCount) / queue.length) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                  <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${((processedCount + errorCount) / queue.length) * 100}%` }}></div>
                </div>
              </div>
            )}

            {processingStatus === 'done' && pendingCount === 0 && errorCount === 0 && (
              <div className="w-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2">
                <CheckCircle size={18} /> Batch Complete
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      {queue.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 backdrop-blur-sm shadow-sm dark:shadow-none flex items-center justify-between transition-colors">
          <div className="flex relative z-0 w-full bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('single')}
              className={`relative flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 ${viewMode === 'single' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <span className="relative z-10">Single View</span>
              {viewMode === 'single' && (
                <motion.div layoutId="viewToggle" className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-lg z-0" />
              )}
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`relative flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 ${viewMode === 'grouped' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <span className="relative z-10">Grouped Analytics</span>
              {viewMode === 'grouped' && (
                <motion.div layoutId="viewToggle" className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-lg z-0" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail Gallery */}
      {queue.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-sm dark:shadow-none min-h-[250px] max-h-[400px] flex flex-col transition-colors">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-wider shrink-0 flex items-center justify-between">
            File Queue
            <div className="flex items-center gap-2 text-xs font-medium normal-case tracking-normal">
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">Queue: {queue.length}</span>
              <span className="bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-600 dark:text-emerald-400">Done: {processedCount}</span>
            </div>
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {queue.map((qItem, idx) => {
              const isSelected = activeViewIndex === idx && viewMode === 'single';

              return (
                <div
                  role="button"
                  key={qItem.id}
                  onClick={() => {
                    setActiveViewIndex(idx);
                    setViewMode('single');
                  }}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-all 
                                  ${isSelected ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-500/50 dark:bg-cyan-500/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-cyan-300 dark:hover:border-cyan-700'}`}
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qItem.previewUrl} alt="thumb" className="w-full h-full object-cover" />
                    {qItem.status === 'processing' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={14} className="animate-spin text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{qItem.file.name}</p>
                  </div>
                  {qItem.status === 'done' && <CheckCircle size={14} className="text-emerald-500 shrink-0" title="Processed" />}
                  {qItem.status === 'error' && <XCircle size={14} className="text-red-500 shrink-0" title="Failed" />}
                  {qItem.status === 'pending' && <Clock size={14} className="text-slate-400 shrink-0" title="Pending" />}
                  {qItem.status === 'processing' && <Loader2 size={14} className="animate-spin text-cyan-500 shrink-0" title="Processing" />}
                  {processingStatus !== 'processing' && (
                    <button
                      onClick={(e) => handleRemoveQueueItem(qItem.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                      title="Remove file"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {globalReport.length > 0 && (
        <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors shrink-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 uppercase tracking-wider">
            Export Global Reports
          </h2>
          <div className="flex gap-2">
            <button onClick={downloadJson} className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 transition font-medium text-slate-700 dark:text-slate-200">
              <FileJson size={14} className="text-slate-500" /> JSON
            </button>
            <button onClick={downloadCsv} className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 transition font-medium text-slate-700 dark:text-slate-200">
              <FileSpreadsheet size={14} className="text-slate-500" /> CSV
            </button>
          </div>
        </div>
      )}
    </>
  );
}
