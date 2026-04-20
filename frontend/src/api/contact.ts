const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
const BASE = `${API_ORIGIN}/api/contacts`;

export interface ContactPayload {
  category: string;
  subject: string;
  body: string;
}

export interface MyContact {
  id: number;
  category: string;
  subject: string;
  body: string;
  status: 'UNREAD' | 'READ' | 'REPLIED';
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
}

export interface MyContactPage {
  content: MyContact[];
  hasNext: boolean;
  totalCount: number;
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

export async function getMyContacts(accessToken: string, page = 0): Promise<MyContactPage> {
  const res = await fetch(`${BASE}/my?page=${page}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '목록을 불러오지 못했습니다');
  return data as MyContactPage;
}

export async function getMyContactDetail(accessToken: string, id: number): Promise<MyContact> {
  const res = await fetch(`${BASE}/my/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '문의를 불러오지 못했습니다');
  return data as MyContact;
}
