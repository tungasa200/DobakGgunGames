import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  volume?: number;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = 'dobakggun_bgm_muted';

export function useBgm(src: string, opts: Options = {}) {
  const { volume: initVolume = 0.5, storageKey = DEFAULT_STORAGE_KEY } = opts;
  const volumeStorageKey = `${storageKey}_vol`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayingRef = useRef(false);

  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(volumeStorageKey);
      return saved !== null ? parseFloat(saved) : initVolume;
    } catch { return initVolume; }
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

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try { localStorage.setItem(volumeStorageKey, String(volume)); } catch { /* ignore */ }
  }, [volume, volumeStorageKey]);

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
  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);

  return { play, pause, resume, stop, toggleMute, muted, volume, setVolume };
}
