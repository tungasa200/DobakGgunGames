import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import EditorToolbar from './EditorToolbar';
import {
  uploadImageToEditor,
  validateImageFile,
  MAX_IMAGES,
} from '../../hooks/useImageUpload';
import type { UploadFn, ToastFn } from '../../hooks/useImageUpload';
import s from './EditorWrapper.module.css';

interface Props {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
  uploadFn: UploadFn;
  toast: ToastFn;
  disabled?: boolean;
}

export default function EditorWrapper({
  value,
  onChange,
  minHeight = 300,
  placeholder = '내용을 입력하세요…',
  uploadFn,
  toast,
  disabled = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      transformPastedHTML(html) {
        // Word/외부 HTML 붙여넣기 1차 정리: style/class 속성 제거
        return html
          .replace(/\sstyle="[^"]*"/gi, '')
          .replace(/\sclass="[^"]*"/gi, '');
      },
    },
  });

  // 외부에서 value 변경 시 동기화 (수정 페이지 초기 로드)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (current !== value && value !== undefined) {
      editor.commands.setContent(value, false);
    }
  }, [editor, value]);

  // 클립보드 붙여넣기 이미지 처리
  useEffect(() => {
    if (!editor) return;
    const capturedEditor = editor;
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          void uploadImageToEditor(capturedEditor, file, uploadFn, toast);
        }
      }
    }
    const el = capturedEditor.view.dom;
    el.addEventListener('paste', handlePaste as EventListener);
    return () => el.removeEventListener('paste', handlePaste as EventListener);
  }, [editor, uploadFn, toast]);

  // 드래그앤드롭 처리
  function handleDragOver(e: React.DragEvent) {
    const hasFile = Array.from(e.dataTransfer.items).some(i => i.kind === 'file');
    if (!hasFile) return;
    e.preventDefault();
    if (wrapRef.current) {
      wrapRef.current.classList.add(s.dragging);
    }
  }

  function handleDragLeave() {
    if (wrapRef.current) wrapRef.current.classList.remove(s.dragging);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (wrapRef.current) wrapRef.current.classList.remove(s.dragging);
    if (!editor) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      void uploadImageToEditor(editor, file, uploadFn, toast);
    }
  }

  function handleImageFile(file: File) {
    if (!editor) return;
    // 장수 체크
    let count = 0;
    editor.state.doc.descendants(node => { if (node.type.name === 'image') count++; });
    if (count >= MAX_IMAGES) {
      toast('한 글에 이미지는 최대 20장까지', 'error');
      return;
    }
    if (!validateImageFile(file, toast)) return;
    void uploadImageToEditor(editor, file, uploadFn, toast);
  }

  if (!editor) return null;

  return (
    <div
      ref={wrapRef}
      className={s.wrap}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <EditorToolbar editor={editor} onImageFile={handleImageFile} />
      <EditorContent
        editor={editor}
        className={s.content}
        style={{ minHeight }}
      />
    </div>
  );
}
