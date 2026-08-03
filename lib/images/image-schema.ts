import { z } from 'zod';

/**
 * Image Management Types & Schemas
 */

export const IMAGE_TYPE = {
  BEFORE: 'BEFORE',
  AFTER: 'AFTER',
  REFERENCE: 'REFERENCE',
  DOCUMENTATION: 'DOCUMENTATION',
} as const;

export interface AssetImage {
  id: string;
  company_id: string;
  asset_id?: string;
  maintenance_record_id?: string;
  incident_id?: string;
  file_name: string;
  file_path: string;
  file_size_bytes?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  image_type: 'BEFORE' | 'AFTER' | 'REFERENCE' | 'DOCUMENTATION';
  thumbnail_path?: string;
  captured_at?: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImageComparison {
  id: string;
  company_id: string;
  before_image_id: string;
  after_image_id: string;
  asset_id?: string;
  maintenance_record_id?: string;
  incident_id?: string;
  comparison_date: string;
  notes?: string;
  findings?: string;
  created_at: string;
  updated_at: string;
}

export interface ImageGallerySettings {
  id: string;
  company_id: string;
  user_id: string;
  default_view: 'grid' | 'list' | 'carousel';
  items_per_page: number;
  auto_thumbnail: boolean;
  max_image_size_mb: number;
  created_at: string;
  updated_at: string;
}

/**
 * Zod Validation Schemas
 */

export const uploadImageSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'Image must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'Only JPEG, PNG, and WebP are supported'
    ),
  assetId: z.string().uuid().optional(),
  maintenanceRecordId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  imageType: z.enum(['BEFORE', 'AFTER', 'REFERENCE', 'DOCUMENTATION']),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const createComparisonSchema = z.object({
  beforeImageId: z.string().uuid(),
  afterImageId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  maintenanceRecordId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  findings: z.string().max(2000).optional(),
});

export const updateGallerySettingsSchema = z.object({
  defaultView: z.enum(['grid', 'list', 'carousel']).optional(),
  itemsPerPage: z.number().min(6).max(100).optional(),
  autoThumbnail: z.boolean().optional(),
  maxImageSizeMb: z.number().min(1).max(50).optional(),
});

/**
 * Utility Functions
 */

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function generateThumbnailPath(originalPath: string): string {
  const parts = originalPath.split('.');
  const ext = parts.pop();
  return `${parts.join('.')}_thumb.${ext}`;
}
