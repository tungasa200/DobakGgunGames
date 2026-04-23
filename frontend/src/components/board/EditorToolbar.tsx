import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import s from './EditorToolbar.module.css';

interface Props {
  editor: Editor;
  onImageFile: (file: File) => void;
}

export default function EditorToolbar({ editor, onImageFile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkPopover, setLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  function btn(
    label: string,
    onClick: () => void,
    active?: boolean,
    disabled?: boolean,
    title?: string,
  ) {
    return (
      <button
        key={label}
        type="button"
        className={`${s.btn} ${active ? s.active : ''} ${disabled ? s.disabled : ''}`}
        onClick={onClick}
        title={title ?? label}
        disabled={disabled}
      >
        {label}
      </button>
    );
  }

  function handleLinkInsert() {
    const trimmed = linkUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setLinkError('http:// 또는 https://로 시작하는 URL을 입력해 주세요');
      return;
    }
    // javascript: 스킴 이중 차단
    if (/^javascript:/i.test(trimmed)) {
      setLinkError('허용되지 않는 URL 형식입니다');
      return;
    }
    editor.chain().focus().setLink({ href: trimmed, target: '_blank', rel: 'noopener noreferrer' }).run();
    setLinkPopover(false);
    setLinkUrl('');
    setLinkError('');
  }

  function handleImageBtnClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className={s.toolbar}>
      {/* 서식 */}
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), false, '굵게')}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), false, '기울임')}
      {btn('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), false, '밑줄')}
      {btn('S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), false, '취소선')}

      <span className={s.sep} />

      {/* 제목 */}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), false, '제목2')}
      {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), false, '제목3')}

      <span className={s.sep} />

      {/* 목록 */}
      {btn('• 목록', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), false, '순서없는목록')}
      {btn('1. 목록', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), false, '순서있는목록')}

      <span className={s.sep} />

      {/* 블록 */}
      {btn('인용', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), false, '인용구')}
      {btn('코드', () => editor.chain().focus().toggleCode().run(), editor.isActive('code'), false, '인라인 코드')}

      <span className={s.sep} />

      {/* 링크 */}
      <div className={s.linkWrap}>
        {btn('링크', () => { setLinkPopover(p => !p); setLinkUrl(''); setLinkError(''); }, editor.isActive('link'), false, '링크 삽입')}
        {btn('링크해제', () => editor.chain().focus().unsetLink().run(), false, !editor.isActive('link'), '링크 제거')}
        {linkPopover && (
          <div className={s.linkPopover}>
            <input
              type="url"
              className={s.linkInput}
              placeholder="https://"
              value={linkUrl}
              onChange={e => { setLinkUrl(e.target.value); setLinkError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLinkInsert(); } }}
              autoFocus
            />
            {linkError && <p className={s.linkError}>{linkError}</p>}
            <div className={s.linkActions}>
              <button type="button" className={s.linkInsertBtn} onClick={handleLinkInsert}>삽입</button>
              <button type="button" className={s.linkCancelBtn} onClick={() => { setLinkPopover(false); setLinkError(''); }}>취소</button>
            </div>
          </div>
        )}
      </div>

      <span className={s.sep} />

      {/* 이미지 */}
      <button type="button" className={s.btn} onClick={handleImageBtnClick} title="이미지 삽입">
        이미지
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <span className={s.sep} />

      {/* 실행취소/재실행 */}
      {btn('↩', () => editor.chain().focus().undo().run(), false, !editor.can().undo(), '실행취소')}
      {btn('↪', () => editor.chain().focus().redo().run(), false, !editor.can().redo(), '재실행')}
    </div>
  );
}
