'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Check, Copy } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
  isUser?: boolean;
  searchQuery?: string;
  className?: string;
}

function highlightInChildren(children: React.ReactNode, query?: string): React.ReactNode {
  if (!query || !query.trim()) return children;
  const q = query.trim();

  if (typeof children === 'string') {
    const parts = children.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    if (parts.length <= 1) return children;
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-brand/40 text-inherit rounded px-0.5 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  if (Array.isArray(children)) {
    return React.Children.map(children, (child) => highlightInChildren(child, query));
  }

  if (React.isValidElement(children) && (children.props as any)?.children) {
    return React.cloneElement(children, {
      ...children.props,
      children: highlightInChildren((children.props as any).children, query),
    } as any);
  }

  return children;
}

function CodeBlock({
  inline,
  className,
  children,
  isUser,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  isUser?: boolean;
  [key: string]: any;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code
        className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
          isUser
            ? 'bg-white/20 text-white'
            : 'bg-background border border-border text-brand-light'
        }`}
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2.5 rounded-xl overflow-hidden border border-border/80 bg-background/95 text-text-primary text-xs shadow-sm not-prose">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface/90 border-b border-border/70 text-[11px] text-text-secondary font-mono">
        <span>{match ? match[1] : 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 hover:text-text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-surface"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-success" />
              <span className="text-[10px] text-success font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-xs leading-relaxed text-text-primary">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({
  content,
  isUser = false,
  searchQuery = '',
  className = '',
}: MarkdownContentProps) {
  const components = {
    p: ({ children, ...props }: any) => (
      <p className="mb-2 last:mb-0 leading-relaxed break-words" {...props}>
        {highlightInChildren(children, searchQuery)}
      </p>
    ),
    h1: ({ children, ...props }: any) => (
      <h1 className="text-base sm:text-lg font-bold mt-3 mb-2 first:mt-0 leading-snug" {...props}>
        {highlightInChildren(children, searchQuery)}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-sm sm:text-base font-bold mt-2.5 mb-1.5 first:mt-0 leading-snug" {...props}>
        {highlightInChildren(children, searchQuery)}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-xs sm:text-sm font-semibold mt-2 mb-1 first:mt-0 leading-snug" {...props}>
        {highlightInChildren(children, searchQuery)}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="text-xs sm:text-sm font-semibold mt-1.5 mb-1 first:mt-0 leading-snug" {...props}>
        {highlightInChildren(children, searchQuery)}
      </h4>
    ),
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold" {...props}>
        {highlightInChildren(children, searchQuery)}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="italic" {...props}>
        {highlightInChildren(children, searchQuery)}
      </em>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="leading-relaxed" {...props}>
        {highlightInChildren(children, searchQuery)}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className={`border-l-2 pl-3 my-2 italic ${
          isUser ? 'border-white/50 text-white/90' : 'border-brand text-text-secondary'
        }`}
        {...props}
      >
        {highlightInChildren(children, searchQuery)}
      </blockquote>
    ),
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={`underline underline-offset-2 hover:opacity-80 transition-opacity ${
          isUser ? 'text-white font-medium' : 'text-brand-light font-medium'
        }`}
        {...props}
      >
        {highlightInChildren(children, searchQuery)}
      </a>
    ),
    code: ({ inline, className: codeClass, children, ...props }: any) => (
      <CodeBlock inline={inline} className={codeClass} isUser={isUser} {...props}>
        {children}
      </CodeBlock>
    ),
    hr: () => (
      <hr className={`my-3 ${isUser ? 'border-white/30' : 'border-border'}`} />
    ),
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-2 rounded-lg border border-border">
        <table className="min-w-full text-xs divide-y divide-border" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className={isUser ? 'bg-white/10' : 'bg-surface/80'} {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-2.5 py-1.5 text-left font-semibold" {...props}>
        {highlightInChildren(children, searchQuery)}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-2.5 py-1.5 border-t border-border/50" {...props}>
        {highlightInChildren(children, searchQuery)}
      </td>
    ),
  };

  return (
    <div className={`markdown-body text-inherit ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
