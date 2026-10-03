export interface Detection {
  class: string;
  final_confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  flagged_for_review: boolean;
  is_duplicate?: boolean;
  lat?: number;
  lon?: number;
  area_coverage?: number;
  cluster_id?: number | string;
}

export interface ReportData {
  message?: string;
  cleaned_image?: string; // base64 string
  detections?: Detection[];
  report?: unknown[];
  metadata?: {
    total_detections: number;
    flagged_detections: number;
    processing_time_ms: number;
  };
  global_lat?: number;
  global_lon?: number;
}

export interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  data?: ReportData;
  error?: string;
}

export type ViewMode = 'single' | 'grouped';
