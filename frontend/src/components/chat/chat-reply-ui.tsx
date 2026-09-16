'use client';

import React from 'react';
import { CornerUpLeft, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ReplyTarget, truncateText } from '@/lib/chat-utils';

interface ChatReplyBannerProps {
  replyingTo: ReplyTarget | null;
  onCancel: () => void;
}

export function ChatReplyBanner({ replyingTo, onCancel }: ChatReplyBannerProps) {
  if (!replyingTo) return null;

  const isImageOnly = !replyingTo.content && !!replyingTo.imageUrl;
  const previewText = replyingTo.content
    ? truncateText(replyingTo.content.replace(/^\[reply[^\]]*\][\s\S]*?\[\/reply\]\n*/i, ''), 120)
    : isImageOnly
      ? 'Image attachment'
      : 'Message';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: 6, height: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden mb-2"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface/90 border border-brand/30 border-l-4 border-l-brand shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-md bg-brand/15 text-brand flex items-center justify-center flex-shrink-0">
            <CornerUpLeft size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-light">
              <span>Replying to {replyingTo.senderName}</span>
            </div>
            <div className="text-xs text-text-secondary truncate flex items-center gap-1 mt-0.5">
              {isImageOnly && <ImageIcon size={12} className="flex-shrink-0" />}
              <span className="truncate">{previewText}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 rounded-lg hover:bg-background/80 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center flex-shrink-0"
          title="Cancel reply"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
}

interface ChatQuotedPreviewProps {
  reply: {
    messageId?: string;
    senderName: string;
    content: string;
  };
  isUser?: boolean;
  onScrollToMessage?: (messageId?: string) => void;
}

export function ChatQuotedPreview({ reply, isUser = false, onScrollToMessage }: ChatQuotedPreviewProps) {
  const handleClick = () => {
    if (reply.messageId && onScrollToMessage) {
      onScrollToMessage(reply.messageId);
    }
  };

  const preview = truncateText(reply.content, 140);

  return (
    <div
      onClick={handleClick}
      role={reply.messageId ? 'button' : undefined}
      tabIndex={reply.messageId ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group mb-2 px-3 py-1.5 rounded-lg border-l-[3px] text-xs transition-all ${
        isUser
          ? 'bg-black/15 border-white/70 text-white/90 hover:bg-black/25'
          : 'bg-background/80 border-brand text-text-secondary hover:bg-background hover:text-text-primary border border-border/50'
      } ${reply.messageId ? 'cursor-pointer hover:shadow-sm' : ''}`}
      title={reply.messageId ? 'Click to view original message' : undefined}
    >
      <div className="flex items-center gap-1 font-semibold text-[11px] mb-0.5 opacity-90">
        <CornerUpLeft size={11} className="flex-shrink-0" />
        <span className={isUser ? 'text-white' : 'text-brand-light'}>{reply.senderName}</span>
      </div>
      <p className="line-clamp-2 leading-relaxed opacity-85 text-[11px] break-words">
        {preview || 'Referenced message'}
      </p>
    </div>
  );
}
