const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/contact`;

export interface ContactPayload {
  category: string;
  subject: string;
  body: string;
}

export async function sendContact(
  payload: ContactPayload,
  files: File[],
  accessToken: string
): Promise<void> {
  const formData = new FormData();
  formData.append('data', JSON.stringify(payload));
  files.forEach(f => formData.append('files', f));

  const res = await fetch(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '문의 발송에 실패했습니다');
}
