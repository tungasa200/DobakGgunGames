import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchGameStatus } from '../api/games';
import { closeDisabledGame, setLeaveGameHandler } from '../api/gameDisabled';

/** 라우터 안에서 점검 안내 후 홈 이동을 맡는다. */
export function GameDisabledRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    setLeaveGameHandler(() => {
      navigate(window.location.pathname.endsWith('/excel') ? '/excel' : '/', { replace: true });
    });
    return () => setLeaveGameHandler(null);
  }, [navigate]);

  return null;
}

/**
 * 끈 게임의 직접 URL 진입을 막는다. 확인이 끝날 때까지 게임을 띄우지 않고,
 * 상태 조회가 실패하면 통과시킨다(서버의 503 GAME_DISABLED가 다음 방어선).
 *
 * 진입 시 스스로 매칭을 호출하는 페이지(RPS, /yacht, /yacht-bot)에는 씌우지 않는다.
 * 재접속은 서버의 409 ALREADY_IN_ROOM으로만 판별되므로 미리 막으면 진행 중인 방으로 돌아갈 수 없다.
 * 저장된 방 정보로 복귀하는 배틀은 hasRoom으로 알려 통과시킨다.
 */
export default function GameGuard({ gameKey, hasRoom, children }: {
  gameKey?: string;
  hasRoom?: () => boolean;
  children: ReactNode;
}) {
  const { game: paramGame } = useParams<{ game: string }>();
  const key = gameKey ?? paramGame;
  // 게임 중 저장값이 지워져도 화면을 내리지 않도록 진입 시점 값으로 고정한다.
  const [resuming] = useState(() => hasRoom?.() ?? false);
  const [allowedKey, setAllowedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key || resuming) return;
    let cancelled = false;
    fetchGameStatus()
      .catch(() => ({} as Record<string, boolean>))
      .then(status => {
        if (cancelled) return;
        if (status[key] === false) closeDisabledGame();
        else setAllowedKey(key);
      });
    return () => { cancelled = true; };
  }, [key, resuming]);

  if (key && !resuming && allowedKey !== key) return null;
  return <>{children}</>;
}
