const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/board`;

// ──────────────────────────────────────────
// DTO 타입
// ──────────────────────────────────────────

export type PostType = 'TOURNAMENT' | 'NOTICE' | 'FREE';
export type UserRole = 'USER' | 'FRIEND' | 'ADMIN';

export interface BoardAuthor {
  id: number;
  nickname: string;
  profileImage: string | null;
  role: UserRole;
}

export interface TournamentData {
  tournamentDate: string;
  gameKey: string;
  difficultyKey: string;
  winner: string;
  runnerUp?: string | null;
  ranking?: string | null;
  participantCount?: number | null;
  participants?: string | null;
  prize?: string | null;
  sponsor?: string | null;
}

export interface BoardComment {
  id: number;
  postId?: number;
  author: BoardAuthor;
  content: string;
  createdAt: string;
}

export interface BoardPostSummary {
  id: number;
  postType: PostType;
  title: string;
  author: BoardAuthor;
  commentCount: number;
  hasImages: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardPostDetail extends BoardPostSummary {
  contentHtml: string | null;
  tournamentData: TournamentData | null;
  comments: BoardComment[];
  commentTotalCount: number;
  commentHasNext: boolean;
  commentNextCursor: string | null;
}

export interface BoardListResult {
  content: BoardPostSummary[];
  hasNext: boolean;
  totalCount: number;
}

export interface BoardCommentPage {
  content: BoardComment[];
  hasNext: boolean;
  nextCursor: string | null;
}

export interface CreatePostRequest {
  postType: PostType;
  title: string;
  contentHtml?: string | null;
  tournamentData?: TournamentData | null;
}

// ──────────────────────────────────────────
// fetch 헬퍼 (기존 프로젝트 패턴 동일)
// ──────────────────────────────────────────

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || '요청에 실패했습니다');
  return data as T;
}

// ──────────────────────────────────────────
// boardApi 래퍼
// ──────────────────────────────────────────

export const boardApi = {
  listPosts: (
    token: string,
    postType?: PostType,
    page = 0,
    size = 20,
  ): Promise<BoardListResult> => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (postType) params.set('postType', postType);
    return request<BoardListResult>(`${BASE}/posts?${params}`, token);
  },

  getPost: (token: string, id: number): Promise<BoardPostDetail> =>
    request<BoardPostDetail>(`${BASE}/posts/${id}`, token),

  createPost: (token: string, body: CreatePostRequest): Promise<BoardPostDetail> =>
    request<BoardPostDetail>(`${BASE}/posts`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePost: (token: string, id: number, body: CreatePostRequest): Promise<BoardPostDetail> =>
    request<BoardPostDetail>(`${BASE}/posts/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deletePost: (token: string, id: number): Promise<{ message: string }> =>
    request<{ message: string }>(`${BASE}/posts/${id}`, token, { method: 'DELETE' }),

  uploadImage: async (token: string, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || '이미지 업로드에 실패했습니다');
    return data as { url: string };
  },

  getMoreComments: (
    token: string,
    postId: number,
    cursor: string,
    size = 50,
  ): Promise<BoardCommentPage> => {
    const params = new URLSearchParams({ cursor, size: String(size) });
    return request<BoardCommentPage>(`${BASE}/posts/${postId}/comments?${params}`, token);
  },

  createComment: (
    token: string,
    postId: number,
    content: string,
  ): Promise<BoardComment> =>
    request<BoardComment>(`${BASE}/posts/${postId}/comments`, token, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (
    token: string,
    postId: number,
    commentId: number,
  ): Promise<{ message: string }> =>
    request<{ message: string }>(`${BASE}/posts/${postId}/comments/${commentId}`, token, {
      method: 'DELETE',
    }),
};
