import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { patchNoteApi } from '../api/patchnotes';
import type { PatchNote, PatchNoteGame } from '../api/patchnotes';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';

export const GAME_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  ALL:         { label: '전체',     icon: '🎮', color: '#4b5563', bg: '#f3f4f6' },
  COMMON:      { label: '공통',     icon: '⚙️',  color: '#4b5563', bg: '#f3f4f6' },
  MINESWEEPER: { label: '지뢰찾기', icon: '💣', color: '#dc2626', bg: '#fee2e2' },
  BASEBALL:    { label: '숫자야구', icon: '⚾', color: '#2563eb', bg: '#dbeafe' },
  BLOCKFALL:   { label: '블록폴',   icon: '🟦', color: '#7c3aed', bg: '#ede9fe' },
  SOLITAIRE:   { label: '솔리테어', icon: '🃏', color: '#059669', bg: '#d1fae5' },
  APPLE:       { label: '사과게임', icon: '🍎', color: '#ea580c', bg: '#ffedd5' },
};

const FILTER_TABS: PatchNoteGame[] = ['ALL', 'MINESWEEPER', 'BASEBALL', 'BLOCKFALL', 'SOLITAIRE', 'APPLE'];

export default function PatchNotesPage() {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<PatchNoteGame>('ALL');
  const [error, setError] = useState('');

  const load = useCallback(async (game: PatchNoteGame, nextPage: number, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const res = await patchNoteApi.list(game, nextPage);
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

  function handleFilterChange(game: PatchNoteGame) {
    if (game === filter) return;
    setFilter(game);
  }

  function formatDate(iso: string) {
    return iso?.slice(0, 10).replace(/-/g, '.');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />

      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '40px 20px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>패치노트</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, marginBottom: 0 }}>
            게임 업데이트 및 버그 수정 내역
          </p>
        </div>

        {/* 게임 필터 탭 */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24,
          padding: '12px 16px', background: '#fff', borderRadius: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          {FILTER_TABS.map(game => {
            const meta = GAME_META[game];
            const active = filter === game;
            return (
              <button
                key={game}
                onClick={() => handleFilterChange(game)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 999, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
                  background: active ? meta.bg : 'transparent',
                  color: active ? meta.color : '#6b7280',
                  outline: active ? `2px solid ${meta.color}30` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 48 }}>불러오는 중...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#ef4444', padding: 24 }}>{error}</div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14 }}>패치노트가 없습니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map(n => {
              const meta = GAME_META[n.game] ?? GAME_META.COMMON;
              return (
                <Link
                  key={n.id}
                  to={`/patch-notes/${n.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      background: '#fff', borderRadius: 10,
                      padding: '18px 22px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                      borderLeft: `4px solid ${meta.color}`,
                      transition: 'box-shadow 0.15s, transform 0.1s',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* 배지 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: '#e0e7ff', color: '#4338ca',
                      }}>
                        v{n.version}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: meta.bg, color: meta.color,
                      }}>
                        {meta.icon} {meta.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                        {formatDate(n.createdAt)}
                      </span>
                    </div>

                    {/* 제목 */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 5 }}>
                      {n.title}
                    </div>

                    {/* 미리보기 */}
                    {n.content && (
                      <div style={{
                        fontSize: 13, color: '#6b7280', lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {n.content}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* 더 불러오기 */}
        {hasNext && !loading && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => load(filter, page + 1, true)}
              disabled={loadingMore}
              style={{
                padding: '10px 32px', borderRadius: 8, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                opacity: loadingMore ? 0.6 : 1,
              }}
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
