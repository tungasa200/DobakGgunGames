import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, Phase, Player, ChatMessage } from './types';
import { INITIAL_PLAYERS, MOCK_DAY_MESSAGES, MOCK_NIGHT_MAFIA_MESSAGES } from './mockData';

const DAY_DURATION = 30;
const NIGHT_DURATION = 30;

function deepCopyPlayers(players: Player[]): Player[] {
  return players.map(p => ({ ...p }));
}

function getMafiaCount(players: Player[]): number {
  return players.filter(p => p.alive && p.role === 'mafia').length;
}

function getCitizenCount(players: Player[]): number {
  return players.filter(p => p.alive && p.role !== 'mafia').length;
}

function getEliminated(players: Player[]): string | undefined {
  const voteCounts: Record<string, number> = {};
  for (const p of players) {
    if (p.voteTarget) {
      voteCounts[p.voteTarget] = (voteCounts[p.voteTarget] ?? 0) + 1;
    }
  }
  let maxVotes = 0;
  let eliminated: string | undefined;
  for (const [id, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminated = id;
    }
  }
  return eliminated;
}

export function useMafiaGame() {
  const [state, setState] = useState<GameState>({
    phase: 'lobby',
    players: deepCopyPlayers(INITIAL_PLAYERS),
    dayCount: 0,
    timer: DAY_DURATION,
    chatLog: [],
    winner: undefined,
    eliminatedThisRound: undefined,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatIndexRef = useRef(0);
  const chatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chatTimerRef.current) clearInterval(chatTimerRef.current);
    timerRef.current = null;
    chatTimerRef.current = null;
  }, []);

  const startChatAutoMessages = useCallback((phase: Phase, isMafiaPlayer: boolean) => {
    if (chatTimerRef.current) clearInterval(chatTimerRef.current);
    chatIndexRef.current = 0;

    const messages = phase === 'night' && isMafiaPlayer
      ? MOCK_NIGHT_MAFIA_MESSAGES
      : phase === 'day'
      ? MOCK_DAY_MESSAGES
      : [];

    if (messages.length === 0) return;

    chatTimerRef.current = setInterval(() => {
      if (chatIndexRef.current >= messages.length) {
        if (chatTimerRef.current) clearInterval(chatTimerRef.current);
        return;
      }
      const msg: ChatMessage = {
        ...messages[chatIndexRef.current],
        timestamp: Date.now(),
      };
      chatIndexRef.current += 1;
      setState(prev => ({ ...prev, chatLog: [...prev.chatLog, msg] }));
    }, 4000);
  }, []);

  const startTimer = useCallback((duration: number, onEnd: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState(prev => ({ ...prev, timer: duration }));

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timer <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setTimeout(onEnd, 0);
          return { ...prev, timer: 0 };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
  }, []);

  const goToDay = useCallback((players: Player[], dayCount: number, chatLog: ChatMessage[]) => {
    const mePlayer = players.find(p => p.isMe);
    const isMafia = mePlayer?.role === 'mafia';

    setState(prev => ({
      ...prev,
      phase: 'day',
      players,
      dayCount,
      chatLog,
      eliminatedThisRound: undefined,
      winner: undefined,
    }));

    startChatAutoMessages('day', isMafia ?? false);
    startTimer(DAY_DURATION, () => {
      setState(prev => {
        if (prev.phase !== 'day') return prev;
        return { ...prev, phase: 'vote' };
      });
    });
  }, [startTimer, startChatAutoMessages]);

  const goToNight = useCallback((players: Player[], dayCount: number, chatLog: ChatMessage[]) => {
    const mePlayer = players.find(p => p.isMe);
    const isMafia = mePlayer?.role === 'mafia';

    setState(prev => ({
      ...prev,
      phase: 'night',
      players,
      dayCount,
      chatLog,
      eliminatedThisRound: undefined,
    }));

    startChatAutoMessages('night', isMafia ?? false);
    startTimer(NIGHT_DURATION, () => {
      setState(prev => {
        if (prev.phase !== 'night') return prev;

        // 의사 50% 확률로 탈락자 취소 (밤 중 탈락자가 설정된 경우)
        let newPlayers = deepCopyPlayers(prev.players);
        let eliminatedId: string | undefined;

        // 마피아가 살아있는 시민 중 한명을 제거 (랜덤)
        const aliveCitizens = newPlayers.filter(p => p.alive && p.role !== 'mafia');
        if (aliveCitizens.length > 0) {
          const target = aliveCitizens[Math.floor(Math.random() * aliveCitizens.length)];
          const doctorSaves = Math.random() < 0.5;
          if (!doctorSaves) {
            eliminatedId = target.id;
            newPlayers = newPlayers.map(p =>
              p.id === target.id ? { ...p, alive: false } : p
            );
          }
        }

        const mafiaCount = getMafiaCount(newPlayers);
        const citizenCount = getCitizenCount(newPlayers);

        if (mafiaCount === 0) {
          return { ...prev, phase: 'result', players: newPlayers, winner: 'citizen', eliminatedThisRound: eliminatedId };
        }
        if (mafiaCount >= citizenCount) {
          return { ...prev, phase: 'result', players: newPlayers, winner: 'mafia', eliminatedThisRound: eliminatedId };
        }

        return {
          ...prev,
          phase: 'day',
          players: newPlayers,
          dayCount: prev.dayCount + 1,
          eliminatedThisRound: eliminatedId,
        };
      });

      // After state update, restart day timer if still in day
      setTimeout(() => {
        setState(prev => {
          if (prev.phase !== 'day') return prev;
          return prev;
        });
      }, 100);
    });
  }, [startTimer, startChatAutoMessages]);

  // Watch for phase transitions after night timer ends
  useEffect(() => {
    if (state.phase === 'day' && timerRef.current === null) {
      const mePlayer = state.players.find(p => p.isMe);
      const isMafia = mePlayer?.role === 'mafia';
      startChatAutoMessages('day', isMafia ?? false);
      startTimer(DAY_DURATION, () => {
        setState(prev => {
          if (prev.phase !== 'day') return prev;
          return { ...prev, phase: 'vote' };
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const startGame = useCallback(() => {
    clearTimers();
    const players = deepCopyPlayers(INITIAL_PLAYERS);
    setState(prev => ({
      ...prev,
      phase: 'roleReveal',
      players,
      dayCount: 1,
      chatLog: [],
      winner: undefined,
      eliminatedThisRound: undefined,
    }));

    setTimeout(() => {
      goToDay(players, 1, []);
    }, 3500);
  }, [clearTimers, goToDay]);

  const castVote = useCallback((targetId: string) => {
    setState(prev => {
      if (prev.phase !== 'vote') return prev;
      const meId = prev.players.find(p => p.isMe)?.id;
      if (!meId) return prev;
      return {
        ...prev,
        players: prev.players.map(p =>
          p.id === meId ? { ...p, voteTarget: targetId } : p
        ),
      };
    });
  }, []);

  const confirmVote = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'vote') return prev;

      // Simulate other players voting randomly
      const alivePlayers = prev.players.filter(p => p.alive);
      const newPlayers = prev.players.map(p => {
        if (!p.isMe && p.alive && !p.voteTarget) {
          const others = alivePlayers.filter(o => o.id !== p.id);
          const target = others[Math.floor(Math.random() * others.length)];
          return { ...p, voteTarget: target?.id };
        }
        return p;
      });

      const eliminatedId = getEliminated(newPlayers);
      const finalPlayers = newPlayers.map(p =>
        p.id === eliminatedId ? { ...p, alive: false } : p
      );

      return {
        ...prev,
        phase: 'voteResult',
        players: finalPlayers,
        eliminatedThisRound: eliminatedId,
      };
    });
  }, []);

  // Watch voteResult to auto-advance
  useEffect(() => {
    if (state.phase !== 'voteResult') return;

    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'voteResult') return prev;

        const mafiaCount = getMafiaCount(prev.players);
        const citizenCount = getCitizenCount(prev.players);

        if (mafiaCount === 0) {
          return { ...prev, phase: 'result', winner: 'citizen' };
        }
        if (mafiaCount >= citizenCount) {
          return { ...prev, phase: 'result', winner: 'mafia' };
        }

        // Reset votes before night
        const resetPlayers = prev.players.map(p => ({ ...p, voteTarget: undefined }));
        return {
          ...prev,
          phase: 'night',
          players: resetPlayers,
          eliminatedThisRound: undefined,
        };
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [state.phase]);

  // Watch night phase to start its timer
  useEffect(() => {
    if (state.phase !== 'night') return;

    clearTimers();
    const mePlayer = state.players.find(p => p.isMe);
    const isMafia = mePlayer?.role === 'mafia';
    startChatAutoMessages('night', isMafia ?? false);

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timer <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return { ...prev, timer: 0 };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);

    setState(prev => ({ ...prev, timer: NIGHT_DURATION }));

    const nightEnd = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'night') return prev;

        let newPlayers = deepCopyPlayers(prev.players);
        let eliminatedId: string | undefined;

        const aliveCitizens = newPlayers.filter(p => p.alive && p.role !== 'mafia');
        if (aliveCitizens.length > 0) {
          const target = aliveCitizens[Math.floor(Math.random() * aliveCitizens.length)];
          const doctorSaves = Math.random() < 0.5;
          if (!doctorSaves) {
            eliminatedId = target.id;
            newPlayers = newPlayers.map(p =>
              p.id === target.id ? { ...p, alive: false } : p
            );
          }
        }

        const mafiaCount = getMafiaCount(newPlayers);
        const citizenCount = getCitizenCount(newPlayers);

        if (mafiaCount === 0) {
          return { ...prev, phase: 'result', players: newPlayers, winner: 'citizen', eliminatedThisRound: eliminatedId };
        }
        if (mafiaCount >= citizenCount) {
          return { ...prev, phase: 'result', players: newPlayers, winner: 'mafia', eliminatedThisRound: eliminatedId };
        }

        const resetPlayers = newPlayers.map(p => ({ ...p, voteTarget: undefined }));
        return {
          ...prev,
          phase: 'day',
          players: resetPlayers,
          dayCount: prev.dayCount + 1,
          eliminatedThisRound: eliminatedId,
          timer: DAY_DURATION,
        };
      });
    }, NIGHT_DURATION * 1000);

    return () => {
      clearTimers();
      clearTimeout(nightEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === 'night']);

  // Watch day phase to start its timer (only when entering day)
  useEffect(() => {
    if (state.phase !== 'day') return;

    clearTimers();
    const mePlayer = state.players.find(p => p.isMe);
    const isMafia = mePlayer?.role === 'mafia';
    startChatAutoMessages('day', isMafia ?? false);
    setState(prev => ({ ...prev, timer: DAY_DURATION }));

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.timer <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return { ...prev, timer: 0, phase: 'vote' };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);

    return () => {
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === 'day', state.dayCount]);

  const sendChat = useCallback((text: string) => {
    setState(prev => {
      const mePlayer = prev.players.find(p => p.isMe);
      if (!mePlayer) return prev;
      const msg: ChatMessage = {
        playerId: mePlayer.id,
        text,
        timestamp: Date.now(),
        isMafia: prev.phase === 'night' && mePlayer.role === 'mafia',
      };
      return { ...prev, chatLog: [...prev.chatLog, msg] };
    });
  }, []);

  const restartGame = useCallback(() => {
    clearTimers();
    chatIndexRef.current = 0;
    setState({
      phase: 'lobby',
      players: deepCopyPlayers(INITIAL_PLAYERS),
      dayCount: 0,
      timer: DAY_DURATION,
      chatLog: [],
      winner: undefined,
      eliminatedThisRound: undefined,
    });
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Unused exports kept for interface compatibility
  void goToDay;
  void goToNight;

  return {
    state,
    startGame,
    castVote,
    confirmVote,
    sendChat,
    restartGame,
  };
}
