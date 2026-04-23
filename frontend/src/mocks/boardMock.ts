/**
 * 게시판 목 데이터 스토어
 * 백엔드 API 배포 전 UI 개발·테스트 용도.
 * 실제 API 연동 시 boardApi.ts만 전환하고 이 파일은 유지 (테스트 참조용).
 */

import type {
  BoardPostDetail,
  BoardPostSummary,
  BoardComment,
  BoardListResult,
  BoardCommentPage,
  CreatePostRequest,
} from '../api/boardApi';

// ──────────────────────────────────────────
// 초기 목 데이터
// ──────────────────────────────────────────

const MOCK_AUTHOR_FRIEND = {
  id: 1,
  nickname: '도박꾼A',
  profileImage: null,
  role: 'FRIEND' as const,
};

const MOCK_AUTHOR_ADMIN = {
  id: 2,
  nickname: '관리자',
  profileImage: null,
  role: 'ADMIN' as const,
};

let mockPostIdSeq = 10;
let mockCommentIdSeq = 100;

const mockComments: Map<number, BoardComment[]> = new Map([
  [
    1,
    [
      {
        id: 100,
        postId: 1,
        author: { id: 3, nickname: '참가자B', profileImage: null, role: 'FRIEND' },
        content: '좋은 대회였습니다! 다음에도 참가하고 싶어요.',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: 101,
        postId: 1,
        author: MOCK_AUTHOR_ADMIN,
        content: '수고하셨습니다 모두!',
        createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
    ],
  ],
]);

const mockPosts: BoardPostDetail[] = [
  {
    id: 1,
    postType: 'TOURNAMENT',
    title: '4월 블록폴 정기 대회',
    author: MOCK_AUTHOR_FRIEND,
    commentCount: 2,
    hasImages: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    contentHtml: '<p>이번 대회는 정말 치열했습니다. 다들 수고하셨어요!</p>',
    tournamentData: {
      tournamentDate: '2026-04-19',
      gameKey: 'blockfall',
      difficultyKey: 'hard',
      winner: '도박꾼A',
      runnerUp: '참가자B',
      ranking: '1위: 도박꾼A\n2위: 참가자B\n3위: 참가자C',
      participantCount: 6,
      participants: '도박꾼A, 참가자B, 참가자C, 참가자D, 참가자E, 참가자F',
      prize: '스타벅스 기프티콘 2만원',
      sponsor: '도박군 프로젝트',
    },
    comments: mockComments.get(1) ?? [],
    commentTotalCount: 2,
    commentHasNext: false,
    commentNextCursor: null,
  },
  {
    id: 2,
    postType: 'NOTICE',
    title: '5월 대회 일정 안내',
    author: MOCK_AUTHOR_ADMIN,
    commentCount: 0,
    hasImages: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    contentHtml: '<p>5월 대회는 5월 10일(토) 오후 2시에 진행됩니다.</p><p>참가 신청은 이 게시글 댓글로 남겨주세요.</p>',
    tournamentData: null,
    comments: [],
    commentTotalCount: 0,
    commentHasNext: false,
    commentNextCursor: null,
  },
  {
    id: 3,
    postType: 'FREE',
    title: '요즘 스도쿠에 빠졌어요',
    author: { id: 3, nickname: '참가자B', profileImage: null, role: 'FRIEND' },
    commentCount: 1,
    hasImages: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    contentHtml: '<p>스도쿠 고급 모드 처음으로 클리어했습니다 🎉</p>',
    tournamentData: null,
    comments: [
      {
        id: 102,
        postId: 3,
        author: MOCK_AUTHOR_FRIEND,
        content: '저도 도전해봐야겠어요!',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
      },
    ],
    commentTotalCount: 1,
    commentHasNext: false,
    commentNextCursor: null,
  },
];

// ──────────────────────────────────────────
// Mock API 함수 (boardApi와 동일 시그니처)
// ──────────────────────────────────────────

function delay(ms = 400): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const boardMock = {
  listPosts: async (
    _token: string,
    postType?: 'TOURNAMENT' | 'NOTICE' | 'FREE',
    page = 0,
    size = 20,
  ): Promise<BoardListResult> => {
    await delay();
    const filtered = postType
      ? mockPosts.filter(p => p.postType === postType)
      : [...mockPosts];
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const start = page * size;
    const content: BoardPostSummary[] = sorted.slice(start, start + size).map(p => ({
      id: p.id,
      postType: p.postType,
      title: p.title,
      author: p.author,
      commentCount: p.commentTotalCount,
      hasImages: p.hasImages,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    return {
      content,
      hasNext: start + size < filtered.length,
      totalCount: filtered.length,
    };
  },

  getPost: async (_token: string, id: number): Promise<BoardPostDetail> => {
    await delay();
    const post = mockPosts.find(p => p.id === id);
    if (!post) throw new Error('POST_NOT_FOUND');
    return { ...post, comments: mockComments.get(id) ?? [] };
  },

  createPost: async (_token: string, body: CreatePostRequest): Promise<BoardPostDetail> => {
    await delay();
    const now = new Date().toISOString();
    mockPostIdSeq++;
    const newPost: BoardPostDetail = {
      id: mockPostIdSeq,
      postType: body.postType,
      title: body.title,
      author: MOCK_AUTHOR_FRIEND,
      commentCount: 0,
      hasImages: false,
      createdAt: now,
      updatedAt: now,
      contentHtml: body.contentHtml ?? null,
      tournamentData: body.tournamentData ?? null,
      comments: [],
      commentTotalCount: 0,
      commentHasNext: false,
      commentNextCursor: null,
    };
    mockPosts.unshift(newPost);
    return newPost;
  },

  updatePost: async (_token: string, id: number, body: CreatePostRequest): Promise<BoardPostDetail> => {
    await delay();
    const idx = mockPosts.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('POST_NOT_FOUND');
    const updated: BoardPostDetail = {
      ...mockPosts[idx],
      title: body.title,
      contentHtml: body.contentHtml ?? null,
      tournamentData: body.tournamentData ?? null,
      updatedAt: new Date().toISOString(),
    };
    mockPosts[idx] = updated;
    return updated;
  },

  deletePost: async (_token: string, id: number): Promise<{ message: string }> => {
    await delay();
    const idx = mockPosts.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('POST_NOT_FOUND');
    mockPosts.splice(idx, 1);
    return { message: '글이 삭제되었습니다' };
  },

  uploadImage: async (_token: string, file: File): Promise<{ url: string }> => {
    await delay(800);
    // 목 환경에서는 blob URL을 그대로 반환 (실제 업로드 없음)
    const blobUrl = URL.createObjectURL(file);
    return { url: blobUrl };
  },

  getMoreComments: async (
    _token: string,
    postId: number,
    cursor: string,
    size = 50,
  ): Promise<BoardCommentPage> => {
    await delay();
    const all = mockComments.get(postId) ?? [];
    const cursorId = parseInt(cursor, 10);
    const after = all.filter(c => c.id > cursorId);
    const content = after.slice(0, size);
    return {
      content,
      hasNext: after.length > size,
      nextCursor: content.length > 0 ? String(content[content.length - 1].id) : null,
    };
  },

  createComment: async (
    _token: string,
    postId: number,
    content: string,
  ): Promise<BoardComment> => {
    await delay();
    mockCommentIdSeq++;
    const comment: BoardComment = {
      id: mockCommentIdSeq,
      postId,
      author: MOCK_AUTHOR_FRIEND,
      content,
      createdAt: new Date().toISOString(),
    };
    const list = mockComments.get(postId) ?? [];
    list.push(comment);
    mockComments.set(postId, list);
    // 글 commentCount 갱신
    const postIdx = mockPosts.findIndex(p => p.id === postId);
    if (postIdx !== -1) {
      mockPosts[postIdx] = {
        ...mockPosts[postIdx],
        commentTotalCount: mockPosts[postIdx].commentTotalCount + 1,
        commentCount: mockPosts[postIdx].commentCount + 1,
      };
    }
    return comment;
  },

  deleteComment: async (
    _token: string,
    postId: number,
    commentId: number,
  ): Promise<{ message: string }> => {
    await delay();
    const list = mockComments.get(postId) ?? [];
    const idx = list.findIndex(c => c.id === commentId);
    if (idx !== -1) list.splice(idx, 1);
    return { message: '댓글이 삭제되었습니다' };
  },
};
