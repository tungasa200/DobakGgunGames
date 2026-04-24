const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/chat`;

export interface ChatRoomSummary {
  roomId: string;
  name: string;
  creatorId: string;
  creatorNick: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface GetRoomsResponse {
  rooms: ChatRoomSummary[];
  degraded: boolean;
}

export interface CreateRoomRequest {
  name: string;
}

export interface CreateRoomResponse {
  roomId: string;
  name: string;
  creatorNick: string;
  createdAt: string;
}

export interface ChatMessageData {
  type: 'CHAT' | 'SYSTEM';
  userId: number | null;
  nickname: string;
  message: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  roomId: string;
  roomName: string;
  creatorId: string;
  messages: ChatMessageData[];
  degraded: boolean;
}

export interface StompErrorData {
  code: string;
  message: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}

export class ChatApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    ...options,
  });
  const data: ApiErrorBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ChatApiError(
      data.message ?? data.error ?? '요청에 실패했습니다',
      data.code ?? '',
      res.status,
    );
  }
  return data as T;
}

export const chatApi = {
  getRooms: (token: string): Promise<GetRoomsResponse> =>
    request<GetRoomsResponse>(`${BASE}/rooms`, token),

  createRoom: (token: string, req: CreateRoomRequest): Promise<CreateRoomResponse> =>
    request<CreateRoomResponse>(`${BASE}/rooms`, token, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  getHistory: (token: string, roomId: string): Promise<ChatHistoryResponse> =>
    request<ChatHistoryResponse>(`${BASE}/rooms/${encodeURIComponent(roomId)}/history`, token),

  deleteRoom: (token: string, roomId: string): Promise<void> =>
    request<void>(`${BASE}/rooms/${encodeURIComponent(roomId)}`, token, {
      method: 'DELETE',
    }),
};
