import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { patchNoteApi } from '../api/patchnotes';
import type { PatchNote } from '../api/patchnotes';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import { GAME_META } from './PatchNotesPage';
import styles from './PatchNotes.module.css';

export default function PatchNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<PatchNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    patchNoteApi.get(Number(id))
      .then(setNote)
      .catch(() => setError('패치노트를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, [id]);

  function formatDate(iso: string) {
    return iso?.slice(0, 10).replace(/-/g, '.');
  }

  const meta = note ? (GAME_META[note.game] ?? GAME_META.COMMON) : null;

  return (
    <div className={styles.wrap}>
      <NormalHeader accentColor="#101f38" />

      <div className={styles.content}>
        <Link to="/patch-notes" className={styles.backLink}>← 목록으로</Link>

        {loading && <div className={styles.stateBox}>불러오는 중...</div>}
        {error && <div className={`${styles.stateBox} ${styles.stateBoxError}`}>{error}</div>}

        {note && meta && (
          <div className={styles.detailCard} style={{ '--note-color': meta.color } as React.CSSProperties}>
            <div className={styles.detailBar} />
            <div className={styles.detailBody}>
              <div className={styles.badgeRow}>
                <span className={styles.versionBadge}>v{note.version}</span>
                <span className={styles.gameBadge} style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon} {meta.label}
                </span>
                <span className={styles.noteDate}>{formatDate(note.createdAt)}</span>
              </div>

              <h1 className={styles.detailTitle}>{note.title}</h1>
              <div className={styles.detailRule} />
              <div className={styles.detailContent}>{note.content}</div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
