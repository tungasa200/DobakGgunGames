/**
 * 이미지 업로드 훅 — 파일선택 / 드래그앤드롭 / 붙여넣기 3경로 통합
 * Editor 컴포넌트에서 참조하며, File 검증 → 콜백 형태로 구성.
 */

import type { Editor } from '@tiptap/react';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES = 20;

export type UploadFn = (file: File) => Promise<{ url: string }>;
export type ToastFn = (msg: string, type?: 'error' | 'info') => void;

function countImages(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants(node => {
    if (node.type.name === 'image') count++;
  });
  return count;
}

function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function validateImageFile(
  file: File,
  toast: ToastFn,
): boolean {
  if (!ALLOWED_MIME.includes(file.type)) {
    toast('지원 형식: jpg, jpeg, png, gif, webp', 'error');
    return false;
  }
  const ext = getExt(file.name);
  if (!ALLOWED_EXT.includes(ext)) {
    toast('지원 형식: jpg, jpeg, png, gif, webp', 'error');
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast('이미지는 50MB 이하만 업로드 가능합니다', 'error');
    return false;
  }
  return true;
}

/**
 * 이미지를 에디터에 업로드하는 핵심 로직.
 * placeholder 삽입 → 업로드 → URL 교체 (실패 시 placeholder 유지 + 재시도 가능)
 */
export async function uploadImageToEditor(
  editor: Editor,
  file: File,
  uploadFn: UploadFn,
  toast: ToastFn,
  onRetry?: (file: File) => void,
): Promise<void> {
  if (countImages(editor) >= MAX_IMAGES) {
    toast('한 글에 이미지는 최대 20장까지', 'error');
    return;
  }
  if (!validateImageFile(file, toast)) return;

  // blob URL로 즉시 placeholder 삽입 (로딩 state는 data 속성으로 표시)
  const blobUrl = URL.createObjectURL(file);
  editor.chain().focus().setImage({ src: blobUrl }).run();

  try {
    const { url } = await uploadFn(file);
    // ProseMirror transaction으로 blob src → 실제 URL 교체
    const { state, view } = editor;
    const tr = state.tr;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === blobUrl) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url });
      }
    });
    if (tr.docChanged) view.dispatch(tr);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // 실패 시: blob URL을 에러 상태 마킹 (src에 special prefix 추가)
    const { state, view } = editor;
    const tr = state.tr;
    const errorSrc = `__upload_error__:${blobUrl}`;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === blobUrl) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          src: errorSrc,
          title: '__upload_error__',
        });
      }
    });
    if (tr.docChanged) view.dispatch(tr);
    toast('이미지 업로드에 실패했습니다', 'error');
    if (onRetry) onRetry(file);
  }
}

export { MAX_IMAGES, MAX_BYTES, ALLOWED_MIME, ALLOWED_EXT };
