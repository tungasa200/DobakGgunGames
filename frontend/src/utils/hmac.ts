/**
 * 클라이언트 사이드 HMAC-SHA256 토큰 생성
 * Web Crypto API 사용 (브라우저 내장)
 *
 * 토큰 payload 형식: "game:level:value:timestamp"
 * value = 게임별 주요 지표 (time, score, attempts)
 */

const SECRET = import.meta.env.VITE_HMAC_SECRET as string;

async function sign(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createToken(
  game: string,
  level: string,
  value: string | number
): Promise<{ token: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${game}:${level}:${value}:${timestamp}`;
  const token = await sign(payload);
  return { token, timestamp };
}
