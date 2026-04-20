import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patchNoteApi } from '../api/patchnotes';
import type { PatchNote } from '../api/patchnotes';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';

export default function PatchNotesPage() {
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    patchNoteApi.list()
      .then(setNotes)
      .catch(() => setError('패치노트를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />
      <div style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1f2937', marginBottom: 28 }}>패치노트</h1>

        {loading && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>불러오는 중...</div>}
        {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: 20 }}>{error}</div>}

        {notes.map(n => (
          <Link
            key={n.id}
            to={`/patch-notes/${n.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{
              background: '#fff', borderRadius: 10, padding: '20px 24px', marginBottom: 14,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              transition: 'box-shadow 0.15s',
            }}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca' }}>
                  v{n.version}
                </span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{n.createdAt?.slice(0, 10)}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>{n.title}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {n.content.slice(0, 120)}
              </div>
            </div>
          </Link>
        ))}

        {!loading && notes.length === 0 && !error && (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: 48 }}>패치노트가 없습니다</div>
        )}
      </div>
      <Footer />
    </div>
  );
}
