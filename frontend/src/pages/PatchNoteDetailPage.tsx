import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { patchNoteApi } from '../api/patchnotes';
import type { PatchNote } from '../api/patchnotes';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';

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

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '40px 20px' }}>
        <Link to="/patch-notes" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
          ← 목록으로
        </Link>

        {loading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>불러오는 중...</div>}
        {error && <div style={{ color: '#ef4444' }}>{error}</div>}

        {note && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 36px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca' }}>
                v{note.version}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{note.createdAt?.slice(0, 10)}</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937', marginBottom: 24 }}>{note.title}</h1>
            <div style={{ fontSize: 15, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {note.content}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
