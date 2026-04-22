import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  volume?: number;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = 'dobakggun_bgm_muted';

export function useBgm(src: string, opts: Options = {}) {
  const { volume = 0.5, storageKey = DEFAULT_STORAGE_KEY } = opts;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayingRef = useRef(false);

  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audio.muted = muted;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      wasPlayingRef.current = false;
    };
  // 의도적으로 초기 마운트에서만 인스턴스 생성 (src 변경 시 재생성)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
    try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch { /* ignore */ }
  }, [muted, storageKey]);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    wasPlayingRef.current = true;
    a.play().catch(() => { /* autoplay 차단 시 무시 */ });
  }, []);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
  }, []);

  const resume = useCallback(() => {
    const a = audioRef.current;
    if (!a || !wasPlayingRef.current) return;
    a.play().catch(() => { /* ignore */ });
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    wasPlayingRef.current = false;
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  return { play, pause, resume, stop, toggleMute, muted };
}
