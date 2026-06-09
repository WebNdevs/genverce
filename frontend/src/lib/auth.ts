import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// Read auth state synchronously from localStorage on the client.
// On the server (SSR) localStorage is unavailable, so we return the empty state.
const readLocalStorage = () => {
  if (typeof window === 'undefined') {
    return { user: null as User | null, token: null as string | null, isAuthenticated: false, hydrated: false };
  }
  try {
    const user: User | null = JSON.parse(localStorage.getItem('genverce_user') || 'null');
    const token = localStorage.getItem('genverce_token');
    return { user, token, isAuthenticated: !!token, hydrated: true };
  } catch {
    return { user: null as User | null, token: null as string | null, isAuthenticated: false, hydrated: true };
  }
};

const initial = readLocalStorage();

export const useAuthStore = create<AuthState>((set) => ({
  ...initial,

  // hydrate() is kept for backwards compatibility but is now a no-op on the
  // client because the store is already populated synchronously above.
  hydrate: () => {
    const user: User | null = JSON.parse(localStorage.getItem('genverce_user') || 'null');
    const token = localStorage.getItem('genverce_token');
    set({ user, token, isAuthenticated: !!token, hydrated: true });
  },

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('genverce_token', token);
    localStorage.setItem('genverce_refresh_token', refreshToken);
    localStorage.setItem('genverce_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, hydrated: true });
  },

  logout: () => {
    localStorage.removeItem('genverce_token');
    localStorage.removeItem('genverce_refresh_token');
    localStorage.removeItem('genverce_user');
    set({ user: null, token: null, isAuthenticated: false, hydrated: true });
  },

  updateUser: (updates) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...updates } : null;
      if (updatedUser) {
        localStorage.setItem('genverce_user', JSON.stringify(updatedUser));
      }
      return { user: updatedUser };
    });
  },
}));
