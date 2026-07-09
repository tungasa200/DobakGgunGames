import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { patchNoteApi } from '../api/patchnotes';
import type { PatchNote, PatchNoteGame } from '../api/patchnotes';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import styles from './PatchNotes.module.css';

export const GAME_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  ALL:         { label: '공용',     icon: '📢', color: '#4b5563', bg: '#f3f4f6' },
  COMMON:      { label: '공통',     icon: '⚙️',  color: '#4b5563', bg: '#f3f4f6' },
  MINESWEEPER: { label: '지뢰찾기', icon: '💣', color: '#dc2626', bg: '#fee2e2' },
  BASEBALL:    { label: '숫자야구', icon: '⚾', color: '#2563eb', bg: '#dbeafe' },
  BLOCKFALL:   { label: '블록폴',   icon: '🟦', color: '#7c3aed', bg: '#ede9fe' },
  SOLITAIRE:   { label: '솔리테어', icon: '🃏', color: '#059669', bg: '#d1fae5' },
  APPLE:       { label: '사과게임', icon: '🍎', color: '#ea580c', bg: '#ffedd5' },
  SUDOKU:      { label: '스도쿠',   icon: '🔢', color: '#0891b2', bg: '#cffafe' },
};

type FilterTab = PatchNoteGame | 'TOTAL';
const FILTER_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  TOTAL: { label: '전체', icon: '🎮', color: '#4b5563', bg: '#f3f4f6' },
  ...GAME_META,
};
const FILTER_TABS: FilterTab[] = ['TOTAL', 'ALL', 'MINESWEEPER', 'BASEBALL', 'BLOCKFALL', 'SOLITAIRE', 'APPLE', 'SUDOKU'];

export default function PatchNotesPage() {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterTab>('TOTAL');
  const [error, setError] = useState('');

  const load = useCallback(async (game: FilterTab, nextPage: number, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const apiGame = game === 'TOTAL' ? undefined : game;
      const res = await patchNoteApi.list(apiGame, nextPage);
      setNotes(prev => append ? [...prev, ...res.content] : res.content);
      setHasNext(res.hasNext);
      setPage(nextPage);
    } catch {
      setError('패치노트를 불러오지 못했습니다');
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, 0, false);
  }, [filter, load]);

  function handleFilterChange(game: FilterTab) {
    if (game === filter) return;
    setFilter(game);
  }

  function formatDate(iso: string) {
    return iso?.slice(0, 10).replace(/-/g, '.');
  }

  return (
    <div className={styles.wrap}>
      <NormalHeader accentColor="#101f38" />

      <div className={styles.content}>
        <div className={styles.headBlock}>
          <h1 className={styles.pageTitle}>패치노트</h1>
          <p className={styles.pageDesc}>게임 업데이트 및 버그 수정 내역</p>
        </div>

        <div className={styles.filters}>
          {FILTER_TABS.map(game => {
            const meta = FILTER_META[game];
            const active = filter === game;
            return (
              <button
                key={game}
                onClick={() => handleFilterChange(game)}
                className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`}
                style={active ? { background: meta.bg, color: meta.color } : undefined}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className={styles.stateBox}>불러오는 중...</div>
        ) : error ? (
          <div className={`${styles.stateBox} ${styles.stateBoxError}`}>{error}</div>
        ) : notes.length === 0 ? (
          <div className={styles.stateBox}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyText}>패치노트가 없습니다</div>
          </div>
        ) : (
          <div className={styles.list}>
            {notes.map(n => {
              const meta = GAME_META[n.game] ?? GAME_META.COMMON;
              return (
                <Link
                  key={n.id}
                  to={`/patch-notes/${n.id}`}
                  className={styles.noteCard}
                  style={{ '--note-color': meta.color } as React.CSSProperties}
                >
                  <div className={styles.badgeRow}>
                    <span className={styles.versionBadge}>v{n.version}</span>
                    <span className={styles.gameBadge} style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className={styles.noteDate}>{formatDate(n.createdAt)}</span>
                  </div>
                  <div className={styles.noteTitle}>{n.title}</div>
                  {n.content && <div className={styles.notePreview}>{n.content}</div>}
                </Link>
              );
            })}
          </div>
        )}

        {hasNext && !loading && (
          <div className={styles.loadMoreWrap}>
            <button
              onClick={() => load(filter, page + 1, true)}
              disabled={loadingMore}
              className={styles.loadMoreBtn}
            >
              {loadingMore ? '불러오는 중...' : '더 보기'}
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
