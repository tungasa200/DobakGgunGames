import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendContact } from '../api/contact';
import NormalHeader from '../components/normal/NormalHeader';
import Footer from '../components/normal/Footer';
import s from './auth.module.css';
import cs from './ContactPage.module.css';

const CATEGORIES = ['문의', '피드백', '버그 신고', '기타'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

export default function ContactPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 비로그인 안내
  if (!user || !accessToken) {
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#f0f0f0', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
        <NormalHeader accentColor="#2c3e50" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className={s.card} style={{ textAlign: 'center' }}>
            <div className={s.logo}>🔒</div>
            <h1 className={s.title}>로그인이 필요합니다</h1>
            <p className={s.subtitle}>문의/피드백 기능은 로그인 후 이용하실 수 있습니다</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
              <button className={s.btn} onClick={() => navigate('/login')}>로그인하러 가기</button>
              <button className={s.btnSecondary} onClick={() => navigate('/')}>메인으로 돌아가기</button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError('');
    const selected = Array.from(e.target.files ?? []);
    const next = [...files, ...selected];

    if (next.length > MAX_FILES) {
      setFileError(`파일은 최대 ${MAX_FILES}개까지 첨부 가능합니다`);
      e.target.value = '';
      return;
    }

    const oversized = selected.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError('파일 하나당 최대 10MB까지 첨부 가능합니다');
      e.target.value = '';
      return;
    }

    const invalid = selected.find(f => !ALLOWED_TYPES.includes(f.type));
    if (invalid) {
      setFileError('이미지(JPG·PNG·GIF·WebP), PDF, TXT 파일만 첨부 가능합니다');
      e.target.value = '';
      return;
    }

    setFiles(next);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setFileError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (!category) { setSubmitError('문의 유형을 선택해 주세요'); return; }
    if (!subject.trim()) { setSubmitError('제목을 입력해 주세요'); return; }
    if (!body.trim()) { setSubmitError('내용을 입력해 주세요'); return; }

    setLoading(true);
    try {
      await sendContact({ category, subject: subject.trim(), body: body.trim() }, files, accessToken);
      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '문의 발송에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  const layout = (content: React.ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#f0f0f0', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
      <NormalHeader accentColor="#2c3e50" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: 'max-content' }}>
        <div className={`${s.card} ${cs.wide}`}>
          {content}
        </div>
      </div>
      <Footer />
    </div>
  );

  if (success) {
    return layout(
      <>
        <div className={s.logo}>✅</div>
        <h1 className={s.title}>문의가 접수되었습니다</h1>
        <p className={s.subtitle}>빠른 시일 내에 회신드리겠습니다</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
          <button className={s.btn} onClick={() => navigate('/')}>메인으로 돌아가기</button>
          <button className={s.btnSecondary} onClick={() => { setSuccess(false); setCategory(''); setSubject(''); setBody(''); setFiles([]); }}>
            추가 문의하기
          </button>
        </div>
      </>
    );
  }

  return layout(
    <>
      <div className={s.logo}>📬</div>
      <h1 className={s.title}>문의 / 피드백</h1>
      <p className={s.subtitle}>궁금한 점이나 의견을 남겨주세요</p>

      {submitError && <div className={s.error}>{submitError}</div>}

      <form className={s.form} onSubmit={handleSubmit}>

        {/* 유형 */}
        <div className={s.field}>
          <label className={s.label}>문의 유형 <span style={{ color: '#e74c3c' }}>*</span></label>
          <div className={cs.categoryRow}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`${cs.catBtn} ${category === cat ? cs.catBtnActive : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div className={s.field}>
          <label className={s.label}>제목 <span style={{ color: '#e74c3c' }}>*</span></label>
          <input
            className={s.input}
            type="text"
            placeholder="제목을 입력해 주세요"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={100}
          />
          <span className={s.hint}>{subject.length} / 100</span>
        </div>

        {/* 내용 */}
        <div className={s.field}>
          <label className={s.label}>내용 <span style={{ color: '#e74c3c' }}>*</span></label>
          <textarea
            className={`${s.input} ${cs.textarea}`}
            placeholder="내용을 입력해 주세요"
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={3000}
          />
          <span className={s.hint}>{body.length} / 3000</span>
        </div>

        {/* 파일 첨부 */}
        <div className={s.field}>
          <label className={s.label}>파일 첨부 <span className={s.hint}>(선택 · 최대 {MAX_FILES}개 · 10MB 이하)</span></label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className={cs.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
          >
            파일 선택
          </button>
          {fileError && <span style={{ fontSize: '12px', color: '#e74c3c' }}>{fileError}</span>}
          {files.length > 0 && (
            <ul className={cs.fileList}>
              {files.map((f, i) => (
                <li key={i} className={cs.fileItem}>
                  <span className={cs.fileName}>{f.name}</span>
                  <span className={cs.fileSize}>({(f.size / 1024).toFixed(0)}KB)</span>
                  <button type="button" className={cs.fileRemove} onClick={() => removeFile(i)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className={s.btn} type="submit" disabled={loading}>
          {loading ? '전송 중...' : '문의 보내기'}
        </button>
      </form>
    </>
  );
}
