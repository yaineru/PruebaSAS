'use client';

import { useState } from 'react';

type Props = {
  beforeUrl: string;
  afterUrl: string;
  notes?: string | null;
};

export function AssetImageComparison({ beforeUrl, afterUrl, notes }: Props) {
  const [position, setPosition] = useState(50);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border select-none">
        <img src={afterUrl} alt="Después" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div
          className="absolute inset-0 h-full overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={beforeUrl}
            alt="Antes"
            className="h-full w-full max-w-none object-cover"
            style={{ width: `${10000 / Math.max(position, 1)}%` }}
            draggable={false}
          />
        </div>
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${position}%` }}
        />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">Antes</span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">Después</span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute inset-x-0 bottom-2 mx-auto w-[90%] cursor-ew-resize"
          aria-label="Deslizar para comparar antes y después"
        />
      </div>
      {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
    </div>
  );
}
