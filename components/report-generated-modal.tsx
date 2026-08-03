'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileJson, FolderOpen, Mail, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SendReportEmailModal } from '@/components/send-report-email-modal';

type Props = {
  reportId: string;
  fileName: string;
  downloadUrl?: string;
  recordCount?: number;
  fileSize?: number;
  format?: string;
  onClose?: () => void;
  open?: boolean;
};

/**
 * Modal shown after report generation
 * Allows user to download immediately or view in history
 */
export function ReportGeneratedModal({
  reportId,
  fileName,
  downloadUrl,
  recordCount,
  fileSize,
  format,
  onClose,
  open = true,
}: Props) {
  const router = useRouter();
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Auto-download PDF if configured
  useEffect(() => {
    if (open && downloadUrl && format === 'PDF') {
      // Optionally auto-open PDF in new tab
      // window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, [open, downloadUrl, format]);

  const handleDownload = async () => {
    if (downloadUrl) {
      if (format === 'PDF') {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        // For Excel, create a link and click it
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
    onClose?.();
  };

  const handleViewHistory = () => {
    router.push('/informes');
    onClose?.();
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-green-600" />
              ✓ Informe Generado
            </CardTitle>
            <CardDescription className="mt-2">
              Tu informe ha sido generado exitosamente
            </CardDescription>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Report Details */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Archivo</p>
              <p className="text-sm font-mono break-all">{fileName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {recordCount !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Registros</p>
                  <p className="text-sm font-semibold">{recordCount.toLocaleString()}</p>
                </div>
              )}
              {fileSize !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Tamaño</p>
                  <p className="text-sm font-semibold">{formatFileSize(fileSize)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={handleDownload}
              disabled={!downloadUrl}
              className="gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
            <Button
              onClick={() => setShowEmailModal(true)}
              variant="outline"
              className="gap-2"
              size="sm"
            >
              <Mail className="h-4 w-4" />
              Enviar
            </Button>
            <Button
              onClick={handleViewHistory}
              variant="outline"
              className="gap-2"
              size="sm"
            >
              <FolderOpen className="h-4 w-4" />
              Historial
            </Button>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            El informe está disponible por 30 días en tu historial
          </p>
        </CardContent>
      </Card>
      {showEmailModal && (
        <SendReportEmailModal reportId={reportId} reportLabel={fileName} onClose={() => setShowEmailModal(false)} />
      )}
    </div>
  );
}
