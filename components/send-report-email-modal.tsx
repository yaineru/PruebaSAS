'use client';

import { useState, useTransition } from 'react';
import { Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sendReportByEmail } from '@/lib/actions/reports';

type Props = {
  reportId: string;
  reportLabel: string;
  onClose: () => void;
};

export function SendReportEmailModal({ reportId, reportLabel, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Informe: ${reportLabel}`);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const fd = new FormData();
    fd.append('to', to);
    fd.append('cc', cc);
    fd.append('subject', subject);
    fd.append('message', message);

    startTransition(async () => {
      const result = await sendReportByEmail(reportId, fd);
      if (!result.success) {
        setError(result.error || 'No se pudo enviar el correo.');
        return;
      }
      setSent(result.message || 'Correo enviado correctamente.');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar informe por correo
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                ✓ {sent}
              </div>
              <Button type="button" className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="send-to">Para</Label>
                <Input
                  id="send-to"
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="send-cc">CC (opcional)</Label>
                <Input
                  id="send-cc"
                  type="email"
                  placeholder="copia@empresa.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="send-subject">Asunto</Label>
                <Input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="send-message">Mensaje</Label>
                <textarea
                  id="send-message"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Adjunto encontrarás el informe solicitado..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
