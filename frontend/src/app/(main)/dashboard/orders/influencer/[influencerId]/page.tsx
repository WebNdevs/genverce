'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, ArrowLeft, Image as ImageIcon, Film } from 'lucide-react';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
import { useAuthStore } from '@/lib/auth';
import { Order } from '@/types';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch {
    window.open(url, '_blank');
  }
}

function downloadJson(data: unknown, filename: string) {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(obj);
}

export default function InfluencerProjectsPage() {
  const router = useRouter();
  const { influencerId } = useParams<{ influencerId: string }>();
  const { hydrated, isAuthenticated } = useAuthStore();
  const { data, loading } = useQuery(GET_MY_ORDERS, { fetchPolicy: 'cache-and-network' });
  const orders: Order[] = data?.myOrders ?? [];

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated]);

  const filtered = useMemo(
    () => orders.filter((o) => (o.influencer?.id ?? o.influencerId) === influencerId),
    [orders, influencerId],
  );

  const influencer = filtered[0]?.influencer;

  const grouped = useMemo(() => {
    return [...filtered].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [filtered]);

  const [downloadingAll, setDownloadingAll] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  return (
    <div className="py-2">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {influencer?.avatar ? (
            <img
              src={influencer.avatar}
              alt={influencer.name}
              className="w-9 h-9 rounded-full object-cover border border-border bg-surface flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center text-sm font-bold gradient-text flex-shrink-0">
              {(influencer?.name ?? '?').charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {influencer?.name ? `${influencer.name} — Projects` : 'Influencer Projects'}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              View all projects and download files
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-text-secondary mb-4">No projects found for this influencer.</p>
          <Link href="/dashboard/orders" className="btn-brand">Back to My Orders</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((order) => {
            const svc = order.influencer?.serviceType ?? 'VIDEO_CREATION';
            const isImage = svc === 'IMAGE_CREATION';
            const images = Array.isArray(order.generatedImages) ? order.generatedImages : [];
            const delivered = images.filter((x) => x.delivered === true).length;
            const total = images.length;
            const label = isImage ? `${delivered}/${total} images delivered` : `${order.videosDelivered}/${order.videosOrdered} delivered`;
            const allDelivered = isImage ? total > 0 && delivered === total : order.status === 'DELIVERED';
            const pct = isImage ? (total > 0 ? Math.round((delivered / total) * 100) : 0) : (order.videosOrdered > 0 ? Math.round((order.videosDelivered / order.videosOrdered) * 100) : 0);

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isImage ? <ImageIcon size={16} className="text-brand-light" /> : <Film size={16} className="text-brand-light" />}
                      <p className="font-semibold truncate">{order.projectBrief?.productName ?? 'Project'}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          allDelivered ? 'bg-success/10 text-success border-success/20' : 'bg-surface text-text-secondary border-border'
                        }`}
                      >
                        {allDelivered ? 'Delivered' : 'In progress'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {fmtDate(order.createdAt)} · {label}
                    </p>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-text-secondary mb-1">
                        <span>Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-1.5 bg-gradient-brand rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-text-secondary/70 mt-1">
                        {order.deliveredAt ? `Delivered on ${fmtDate(order.deliveredAt)}` : allDelivered ? 'Delivered' : 'Not delivered yet'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <button
                      onClick={() => downloadJson(order.projectBrief, `project-${order.id.slice(0, 8)}.json`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary hover:border-brand/40 transition-colors"
                    >
                      <Download size={13} /> Download Brief
                    </button>

                    {order.videoUrl && (
                      <button
                        onClick={() => downloadUrl(order.videoUrl!, `video-${order.id.slice(0, 8)}.mp4`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/30 text-success rounded-lg text-xs font-medium hover:bg-success/20 transition-colors"
                      >
                        <Download size={13} /> Download Video
                      </button>
                    )}

                    {isImage && total > 0 && (
                      <button
                        disabled={downloadingAll === order.id}
                        onClick={async () => {
                          setDownloadingAll(order.id);
                          for (let i = 0; i < images.length; i++) {
                            const img = images[i];
                            await downloadUrl(img.url, `image-${order.id.slice(0, 8)}-${i + 1}.png`);
                            await new Promise((r) => setTimeout(r, 200));
                          }
                          setDownloadingAll(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 border border-brand/30 text-brand-light rounded-lg text-xs font-medium hover:bg-brand/20 transition-colors disabled:opacity-60"
                      >
                        <Download size={13} /> {downloadingAll === order.id ? 'Downloading…' : 'Download All Images'}
                      </button>
                    )}
                  </div>
                </div>

                {isImage && total > 0 && (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {images.slice(0, 6).map((img, idx) => (
                      <div
                        key={img.messageId || idx}
                        className="rounded-2xl border border-border overflow-hidden bg-surface hover:border-brand/40 transition-colors"
                      >
                        <button
                          onClick={() => setViewerUrl(img.url)}
                          className="block w-full text-left"
                          aria-label="View image"
                        >
                          <div className="w-full aspect-[16/5] bg-background flex items-center justify-center overflow-hidden">
                            <img src={img.url} alt="Generated" className="w-full h-full object-contain" />
                          </div>
                        </button>
                        <div className="px-3 py-3 flex items-center justify-between gap-2 border-t border-border">
                          <div className="min-w-0">
                            <p className="text-[11px] text-text-secondary truncate">{order.projectBrief?.productName ?? 'Project'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-text-secondary">{idx + 1}/{total}</span>
                              <span className={`text-[11px] font-semibold ${img.delivered ? 'text-success' : 'text-text-secondary'}`}>
                                {img.delivered ? 'Delivered' : 'Pending'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setViewerUrl(img.url)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => downloadUrl(img.url, `image-${order.id.slice(0, 8)}-${idx + 1}.png`)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand/10 border border-brand/30 text-brand-light hover:bg-brand/20 transition-colors"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {images.length > 6 && (
                      <div className="rounded-xl border border-border bg-surface flex items-center justify-center text-xs text-text-secondary">
                        +{images.length - 6} more
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewerUrl(null);
          }}
        >
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-background overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Preview</p>
              <button
                onClick={() => setViewerUrl(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-background">
              <div className="w-full max-h-[75vh] flex items-center justify-center">
                <img src={viewerUrl} alt="Preview" className="max-w-full max-h-[75vh] object-contain" />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setViewerUrl(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => downloadUrl(viewerUrl, `image-preview.png`)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand/10 border border-brand/30 text-brand-light hover:bg-brand/20 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
