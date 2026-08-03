'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, RefreshCw, Trash2, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  uploadAssetImage,
  deleteAssetImage,
  replaceAssetImage,
  createImageComparison,
} from '@/lib/actions/asset-images';
import { AssetImageComparison } from '@/components/asset-image-comparison';

export type GalleryImage = {
  id: string;
  url: string;
  title: string | null;
  imageType: string;
  createdAt: string;
};

export type GalleryComparison = {
  id: string;
  beforeUrl: string;
  afterUrl: string;
  notes: string | null;
};

const IMAGE_TYPE_LABELS: Record<string, string> = {
  BEFORE: 'Antes',
  AFTER: 'Después',
  REFERENCE: 'Referencia',
  DOCUMENTATION: 'Documentación',
};

type Props = {
  assetId: string;
  images: GalleryImage[];
  comparisons: GalleryComparison[];
};

export function AssetImageGallery({ assetId, images, comparisons }: Props) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);

  const uploadFiles = (files: FileList | File[]) => {
    setError('');
    startTransition(async () => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('assetId', assetId);
        form.append('file', file);
        form.append('imageType', 'REFERENCE');
        const result = await uploadAssetImage(form);
        if (!result.success) {
          setError(result.error || 'No se pudo subir una de las imágenes.');
        }
      }
      router.refresh();
    });
  };

  const handleDelete = (imageId: string) => {
    if (!confirm('¿Eliminar esta imagen? Esta acción no se puede deshacer.')) return;
    setError('');
    startTransition(async () => {
      const result = await deleteAssetImage(imageId, assetId);
      if (!result.success) {
        setError(result.error || 'No se pudo eliminar la imagen.');
        return;
      }
      router.refresh();
    });
  };

  const handleReplaceClick = (imageId: string) => {
    replaceTargetId.current = imageId;
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = (file: File | undefined) => {
    if (!file || !replaceTargetId.current) return;
    const targetId = replaceTargetId.current;
    setError('');
    startTransition(async () => {
      const form = new FormData();
      form.append('assetId', assetId);
      form.append('file', file);
      form.append('imageType', 'REFERENCE');
      const result = await replaceAssetImage(targetId, form);
      if (!result.success) {
        setError(result.error || 'No se pudo reemplazar la imagen.');
        return;
      }
      router.refresh();
    });
  };

  const handleCreateComparison = () => {
    if (!beforeId || !afterId || beforeId === afterId) {
      setError('Selecciona dos imágenes distintas para comparar.');
      return;
    }
    setError('');
    startTransition(async () => {
      const form = new FormData();
      form.append('assetId', assetId);
      form.append('beforeImageId', beforeId);
      form.append('afterImageId', afterId);
      const result = await createImageComparison(form);
      if (!result.success) {
        setError(result.error || 'No se pudo crear la comparación.');
        return;
      }
      setBeforeId('');
      setAfterId('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
        }`}
      >
        {isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">Arrastra fotos aquí o haz clic para seleccionar</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG o WebP · hasta 10MB por imagen · opcional</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            handleReplaceFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      )}

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no hay fotografías para este equipo.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border">
              <img src={image.url} alt={image.title || 'Foto del equipo'} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {IMAGE_TYPE_LABELS[image.imageType] || image.imageType}
              </span>
              <div className="absolute inset-0 flex items-end justify-center gap-1 bg-black/0 p-1.5 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => handleReplaceClick(image.id)}
                  title="Reemplazar"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(image.id)}
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length >= 2 && (
        <div className="rounded-md border p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Images className="h-4 w-4" />
            Comparación antes / después
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={beforeId}
              onChange={(e) => setBeforeId(e.target.value)}
            >
              <option value="">Imagen &quot;antes&quot;</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.title || image.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={afterId}
              onChange={(e) => setAfterId(e.target.value)}
            >
              <option value="">Imagen &quot;después&quot;</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.title || image.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={isPending} onClick={handleCreateComparison}>
              Crear comparación
            </Button>
          </div>
        </div>
      )}

      {comparisons.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Comparaciones guardadas</p>
          {comparisons.map((comparison) => (
            <AssetImageComparison
              key={comparison.id}
              beforeUrl={comparison.beforeUrl}
              afterUrl={comparison.afterUrl}
              notes={comparison.notes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
