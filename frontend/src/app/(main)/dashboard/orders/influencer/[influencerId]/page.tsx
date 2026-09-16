'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, ArrowLeft, Image as ImageIcon, Film, FileText, Copy, Check, Sparkles, Plus } from 'lucide-react';
import { GET_MY_ORDERS } from '@/graphql/queries/order';
import { useAuthStore } from '@/lib/auth';
import { Order, GeneratedPost } from '@/types';
import { toast } from '@/components/ui/toaster';

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

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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

  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

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

  const handleCopyPost = (post: GeneratedPost) => {
    const mainText = (post.content && post.content.length >= (post.caption?.length || 0))
      ? post.content
      : (post.caption || '');
    const cleanBody = mainText.replace(/^\*\*|\*\*$/g, '').trim();

    const text = [
      post.title ? `Title: ${post.title}` : '',
      post.topic ? `Topic: ${post.topic}` : '',
      '',
      cleanBody,
      post.callToAction ? `\nCall to Action: ${post.callToAction}` : '',
      Array.isArray(post.hashtags) && post.hashtags.length > 0 ? `\nHashtags: ${post.hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedPostId(post.id);
    toast({ title: 'Post copied!', description: 'Full post content copied to clipboard.', variant: 'success' });
    setTimeout(() => setCopiedPostId(null), 2500);
  };

  return (
    <div className="py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3 min-w-0">
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
                View all deliverables, posts, images, and project files
              </p>
            </div>
          </div>
        </div>

        <Link
          href={`/order/${influencerId}?mode=add-usage`}
          className="btn-brand self-start sm:self-auto text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5 flex-shrink-0 shadow-sm"
        >
          <Plus size={14} />
          <span>Add Usage</span>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-text-secondary mb-4">No projects found for this influencer.</p>
          <Link href="/dashboard/orders" className="btn-brand">Back to My Orders</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((order) => {
            const svc = (order.influencer as any)?.serviceType ?? 'VIDEO_CREATION';
            const isImage = svc === 'IMAGE_CREATION';
            const isPost = svc === 'POST_CREATION';

            const images = Array.isArray(order.generatedImages) ? order.generatedImages : [];
            const posts: GeneratedPost[] = Array.isArray(order.generatedPosts)
              ? order.generatedPosts
              : (order.projectBrief as any)?.generatedPosts || [];

            const imageDelivered = images.filter((x) => x.delivered === true).length;
            const imageTotal = images.length;

            const postDelivered = posts.length;
            const postTotal = order.videosOrdered || 1;

            let label = `${order.videosDelivered}/${order.videosOrdered} delivered`;
            let allDelivered = order.status === 'DELIVERED';
            let pct = 0;

            if (isImage) {
              label = `${imageDelivered}/${imageTotal} images delivered`;
              allDelivered = imageTotal > 0 && imageDelivered === imageTotal;
              pct = imageTotal > 0 ? Math.round((imageDelivered / imageTotal) * 100) : 0;
            } else if (isPost) {
              label = `${postDelivered}/${postTotal} posts created`;
              allDelivered = (postTotal > 0 && postDelivered >= postTotal) || order.status === 'DELIVERED';
              pct = postTotal > 0 ? Math.min(100, Math.round((postDelivered / postTotal) * 100)) : 0;
            } else {
              pct = order.videosOrdered > 0 ? Math.round((order.videosDelivered / order.videosOrdered) * 100) : 0;
            }

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isPost ? (
                        <FileText size={16} className="text-brand-light flex-shrink-0" />
                      ) : isImage ? (
                        <ImageIcon size={16} className="text-brand-light flex-shrink-0" />
                      ) : (
                        <Film size={16} className="text-brand-light flex-shrink-0" />
                      )}
                      <p className="font-semibold truncate">
                        {order.projectBrief?.productName || (posts[0]?.title ?? 'Project')}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          allDelivered ? 'bg-success/10 text-success border-success/20' : 'bg-surface text-text-secondary border-border'
                        }`}
                      >
                        {allDelivered ? 'Delivered' : 'In progress'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {fmtDate(order.createdAt)} · {label} · {order.package?.replace(/_/g, ' ')}
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
                        {order.deliveredAt ? `Delivered on ${fmtDate(order.deliveredAt)}` : allDelivered ? 'Delivered' : 'In production'}
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

                    {posts.length > 0 && (
                      <button
                        onClick={() => downloadJson(posts, `posts-${order.id.slice(0, 8)}.json`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 border border-brand/30 text-brand-light rounded-lg text-xs font-medium hover:bg-brand/20 transition-colors"
                      >
                        <Download size={13} /> Download All Posts
                      </button>
                    )}

                    {order.videoUrl && (
                      <button
                        onClick={() => downloadUrl(order.videoUrl!, `video-${order.id.slice(0, 8)}.mp4`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/30 text-success rounded-lg text-xs font-medium hover:bg-success/20 transition-colors"
                      >
                        <Download size={13} /> Download Video
                      </button>
                    )}

                    {isImage && imageTotal > 0 && (
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

                {/* Generated Posts Section */}
                {posts.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5 text-text-primary">
                        <Sparkles size={14} className="text-brand-light" /> Created Posts ({posts.length})
                      </h3>
                      <span className="text-xs text-text-secondary">Ready for publishing</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {posts.map((post, idx) => {
                        const isCopied = copiedPostId === post.id;
                        const mainText = (post.content && post.content.length >= (post.caption?.length || 0))
                          ? post.content
                          : (post.caption || '');
                        const cleanBody = mainText.replace(/^\*\*|\*\*$/g, '').trim();

                        return (
                          <div
                            key={post.id || idx}
                            className="rounded-xl border border-border bg-surface/80 p-5 transition-all hover:border-brand/40 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand-light text-[11px] font-semibold">
                                    Post #{idx + 1}
                                  </span>
                                  {post.topic && (
                                    <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-text-secondary text-[11px] font-medium truncate max-w-xs">
                                      Topic: {post.topic}
                                    </span>
                                  )}
                                  {post.tone && (
                                    <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-text-secondary text-[11px] font-medium">
                                      Tone: {post.tone}
                                    </span>
                                  )}
                                  {Array.isArray(post.platforms) && post.platforms.length > 0 && post.platforms.map((plat, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="px-2 py-0.5 rounded-md bg-brand/5 border border-brand/20 text-brand-light text-[11px] font-medium"
                                    >
                                      {plat}
                                    </span>
                                  ))}
                                </div>
                                <h4 className="text-base sm:text-lg font-semibold text-text-primary leading-snug">
                                  {post.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleCopyPost(post)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface border border-border hover:border-brand/40 text-text-secondary hover:text-text-primary transition-colors"
                                  title="Copy post content"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check size={12} className="text-success" />
                                      <span className="text-success">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    const postText = [
                                      `# ${post.title}`,
                                      post.topic ? `Topic: ${post.topic}` : '',
                                      post.platforms?.length ? `Platforms: ${post.platforms.join(', ')}` : '',
                                      '',
                                      cleanBody,
                                      post.callToAction ? `\nCall to Action: ${post.callToAction}` : '',
                                      Array.isArray(post.hashtags) && post.hashtags.length > 0 ? `\nHashtags: ${post.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}` : '',
                                    ].filter(Boolean).join('\n');
                                    downloadText(postText, `post-${idx + 1}.txt`);
                                  }}
                                  className="p-1 rounded-lg border border-border hover:border-brand/40 text-text-secondary hover:text-text-primary transition-colors"
                                  title="Download post as text"
                                >
                                  <Download size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Post Body */}
                            <div className="text-xs sm:text-sm text-text-primary/90 whitespace-pre-line leading-relaxed bg-background/60 p-4 rounded-lg border border-border/60">
                              {cleanBody}
                            </div>

                            {/* Call to Action Callout */}
                            {post.callToAction && (
                              <div className="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-brand/5 border border-brand/20 text-xs text-text-primary">
                                <span className="font-semibold text-brand-light flex-shrink-0">Call to Action:</span>
                                <span className="text-text-secondary">{post.callToAction}</span>
                              </div>
                            )}

                            {/* Hashtags */}
                            {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                {post.hashtags.map((tag, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2.5 py-0.5 rounded-md bg-surface text-brand-light text-xs font-medium border border-brand/20"
                                  >
                                    {tag.startsWith('#') ? tag : `#${tag}`}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Post Image Visual if present */}
                            {post.imageUrl && (
                              <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <button
                                    onClick={() => setViewerUrl(post.imageUrl!)}
                                    className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-background flex-shrink-0"
                                  >
                                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                                  </button>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-text-primary truncate">Generated Post Visual</p>
                                    <p className="text-[11px] text-text-secondary truncate">Click image to preview</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => setViewerUrl(post.imageUrl!)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => downloadUrl(post.imageUrl!, `post-visual-${post.id || idx + 1}.png`)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand/10 border border-brand/30 text-brand-light hover:bg-brand/20 transition-colors"
                                  >
                                    Download Image
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Visual Concept if present and no imageUrl */}
                            {post.imagePrompt && !post.imageUrl && (
                              <div className="mt-3 pt-3 border-t border-border flex items-start gap-2.5 text-xs text-text-secondary">
                                <Sparkles size={14} className="text-brand-light flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-medium text-text-primary">AI Visual Concept: </span>
                                  <span>{post.imagePrompt}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Generated Images Section */}
                {isImage && imageTotal > 0 && (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                              <span className="text-[11px] text-text-secondary">{idx + 1}/{imageTotal}</span>
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
