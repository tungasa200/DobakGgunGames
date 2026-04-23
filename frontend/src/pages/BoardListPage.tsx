import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { boardApi as api } from '../api/boardApi';
import type { BoardPostSummary, PostType } from '../api/boardApi';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import PostCard from '../components/board/PostCard';
import ToastContainer from '../components/board/ToastContainer';
import { useToast } from '../hooks/useToast';
import s from './BoardListPage.module.css';

type TabType = 'ALL' | PostType;

const TABS: { key: TabType; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'TOURNAMENT', label: '대회기록' },
  { key: 'NOTICE', label: '공지' },
  { key: 'FREE', label: '자유' },
];

const PAGE_SIZE = 20;

export default function BoardListPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, removeToast } = useToast();

  const tabParam = (searchParams.get('type') ?? 'ALL') as TabType;
  const pageParam = parseInt(searchParams.get('page') ?? '0', 10);

  const [posts, setPosts] = useState<BoardPostSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const token = accessToken ?? '';
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadPosts = useCallback(async (tab: TabType, page: number) => {
    setLoading(true);
    setError('');
    try {
      const postType = tab === 'ALL' ? undefined : tab;
      const res = await api.listPosts(token, postType, page, PAGE_SIZE);
      setPosts(res.content);
      setTotalCount(res.totalCount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '게시글을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPosts(tabParam, pageParam);
  }, [loadPosts, tabParam, pageParam]);

  function setTab(tab: TabType) {
    const next = new URLSearchParams();
    if (tab !== 'ALL') next.set('type', tab);
    setSearchParams(next);
  }

  function setPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
  }

  // 페이지네이션 번호 압축 (7개 초과 시)
  function pageNumbers(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const cur = pageParam;
    const pages: (number | '...')[] = [0];
    if (cur > 2) pages.push('...');
    for (let i = Math.max(1, cur - 1); i <= Math.min(totalPages - 2, cur + 1); i++) pages.push(i);
    if (cur < totalPages - 3) pages.push('...');
    pages.push(totalPages - 1);
    return pages;
  }

  const canWrite = user && (user.role === 'FRIEND' || user.role === 'ADMIN');

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader />
      <div className={s.page}>
        <div className={s.inner}>
          {/* 제목 + 글쓰기 버튼 */}
          <div className={s.titleRow}>
            <h1 className={s.title}>도박군 게시판</h1>
            {canWrite && (
              <button className={s.writeBtn} onClick={() => setModalOpen(true)}>글쓰기</button>
            )}
          </div>

          {/* 탭 필터 */}
          <div className={s.tabs}>
            {TABS.map(t => (
              <button
                key={t.key}
                className={`${s.tab} ${tabParam === t.key ? s.tabActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 목록 */}
          {loading ? (
            <div className={s.skeleton}>
              {[0, 1, 2].map(i => <div key={i} className={s.skeletonCard} />)}
            </div>
          ) : error ? (
            <div className={s.emptyMsg}>
              {error}{' '}
              <button className={s.retryBtn} onClick={() => loadPosts(tabParam, pageParam)}>
                다시 시도
              </button>
            </div>
          ) : posts.length === 0 ? (
            <p className={s.emptyMsg}>아직 게시글이 없습니다</p>
          ) : (
            <div className={s.list}>
              {posts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}

          {/* 페이지네이션 */}
          {!loading && !error && totalPages > 1 && (
            <div className={s.pagination}>
              <button
                className={s.pageBtn}
                onClick={() => setPage(pageParam - 1)}
                disabled={pageParam === 0}
                style={pageParam === 0 ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
              >{'< 이전'}</button>
              {pageNumbers().map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} className={s.ellipsis}>…</span>
                  : (
                    <button
                      key={p}
                      className={`${s.pageBtn} ${p === pageParam ? s.pageBtnCurrent : ''}`}
                      onClick={() => setPage(p as number)}
                    >{(p as number) + 1}</button>
                  ),
              )}
              <button
                className={s.pageBtn}
                onClick={() => setPage(pageParam + 1)}
                disabled={pageParam >= totalPages - 1}
                style={pageParam >= totalPages - 1 ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
              >{'다음 >'}</button>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* 글쓰기 모달 */}
      {modalOpen && (
        <div className={s.overlay} onClick={() => setModalOpen(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <h2 className={s.modalTitle}>글 양식을 선택하세요</h2>
            <hr className={s.modalDivider} />
            {[
              { type: 'TOURNAMENT' as PostType, label: '대회기록', desc: '대회 결과 공유' },
              { type: 'NOTICE' as PostType, label: '공지', desc: '공지사항 작성' },
              { type: 'FREE' as PostType, label: '자유', desc: '자유롭게 이야기' },
            ].map(item => (
              <button
                key={item.type}
                className={s.modalItem}
                onClick={() => { setModalOpen(false); navigate(`/board/new?type=${item.type}`); }}
              >
                <strong>{item.label}</strong>
                <span className={s.modalItemDesc}>{item.desc}</span>
              </button>
            ))}
            <div className={s.modalCancel}>
              <button className={s.cancelBtn} onClick={() => setModalOpen(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
