'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn } from 'lucide-react';

interface ImageBubbleProps {
  src: string;
  alt?: string;
  msgId: string;
}

function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank');
    }
  }, [src]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2 self-end">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            <Download size={13} />
            Download
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Full-size image */}
        <img
          src={src}
          alt={alt ?? 'Generated image'}
          className="rounded-xl object-contain max-w-full max-h-[80vh] shadow-2xl"
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}

export function ImageBubble({ src, alt, msgId }: ImageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${msgId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank');
    }
  }, [src, msgId]);

  return (
    <>
      <div className="relative group/img">
        <img
          src={src}
          alt={alt ?? 'Generated image'}
          className="rounded-xl max-w-full max-h-80 object-contain cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        />

        {/* Hover overlay buttons */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
          <button
            onClick={() => setLightboxOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition-colors"
            title="View full size"
          >
            <ZoomIn size={13} />
            View
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition-colors"
            title="Download image"
          >
            <Download size={13} />
            Download
          </button>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
