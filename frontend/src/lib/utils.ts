import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPublicAssetUrl(input?: string | null) {
  const value = String(input ?? '').trim();
  if (!value) return value;

  const publicApi = String(process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (!publicApi) return value;

  return value.replace(/^https?:\/\/localhost:4000/i, publicApi);
}
