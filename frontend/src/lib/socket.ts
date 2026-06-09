import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'}/chat`, {
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket();
  const next = (token ?? '').trim();
  const prev = (socketToken ?? '').trim();
  if (prev !== next) {
    socketToken = next;
    if (s.connected) s.disconnect();
    s.auth = { token: next };
  } else if (!(s as any).auth?.token) {
    s.auth = { token: next };
  }
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
