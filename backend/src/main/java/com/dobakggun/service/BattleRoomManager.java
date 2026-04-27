package com.dobakggun.service;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * 블록폴 배틀 인메모리 방 상태 관리 컴포넌트.
 * PRD §14.1 — 단일 인스턴스 인메모리 운영 (Redis 미사용).
 */
@Slf4j
@Component
public class BattleRoomManager {

    // ─── 인메모리 저장소 ──────────────────────────────────────────────────────

    /** roomId → 참가자 목록 */
    private final ConcurrentHashMap<String, List<PlayerSessionInfo>> activePlayers = new ConcurrentHashMap<>();

    /** roomId → 대기열 (FIFO) */
    private final ConcurrentHashMap<String, LinkedBlockingDeque<PlayerSessionInfo>> queues = new ConcurrentHashMap<>();

    /** sessionId → roomId 역방향 조회 */
    private final ConcurrentHashMap<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    // ─── PlayerSessionInfo ────────────────────────────────────────────────────

    @Getter
    @Setter
    public static class PlayerSessionInfo {
        private final String playerId;   // userId string 또는 guest_{uuid}
        private final String nickname;
        private final boolean guest;
        private volatile String sessionId;
        private final Long userId;       // 게스트이면 null
        private volatile boolean alive;
        private volatile int score;
        private volatile int rank;       // 0 = 미결정
        /** BUG-004 수정: 자발적 이탈 여부. true 면 finishGame 전적 저장 대상 제외. */
        private volatile boolean voluntaryLeft;

        public PlayerSessionInfo(String playerId, String nickname, boolean guest,
                                  String sessionId, Long userId) {
            this.playerId = playerId;
            this.nickname = nickname;
            this.guest = guest;
            this.sessionId = sessionId;
            this.userId = userId;
            this.alive = true;
            this.score = 0;
            this.rank = 0;
            this.voluntaryLeft = false;
        }
    }

    // ─── 공개 API ────────────────────────────────────────────────────────────

    /**
     * 방에 참가자를 추가한다.
     * @return true: 즉시 참가, false: 큐에 진입
     */
    public boolean joinRoom(String roomId, PlayerSessionInfo player) {
        activePlayers.putIfAbsent(roomId, new CopyOnWriteArrayList<>());
        queues.putIfAbsent(roomId, new LinkedBlockingDeque<>());

        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        synchronized (players) {
            if (players.size() < 4) {
                players.add(player);
                // BUG-003 수정: REST 단계에서 sessionId가 null일 수 있음.
                // WebSocket 연결 시 registerSession()으로 실제 sessionId 등록.
                if (player.getSessionId() != null) {
                    sessionRoomMap.put(player.getSessionId(), roomId);
                }
                log.debug("BattleRoomManager.joinRoom: roomId={} playerId={} (직접 참가)", roomId, player.getPlayerId());
                return true;
            }
        }
        // 정원 초과 → 큐 진입
        queues.get(roomId).offerLast(player);
        if (player.getSessionId() != null) {
            sessionRoomMap.put(player.getSessionId(), roomId);
        }
        log.debug("BattleRoomManager.joinRoom: roomId={} playerId={} (큐 진입)", roomId, player.getPlayerId());
        return false;
    }

    /**
     * 세션 연결 끊김/LEAVE 시 참가자 제거.
     * @return 제거된 플레이어 정보 (없으면 null)
     */
    public PlayerSessionInfo removePlayer(String sessionId) {
        String roomId = sessionRoomMap.remove(sessionId);
        if (roomId == null) return null;

        // 활성 참가자에서 제거 시도
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players != null) {
            synchronized (players) {
                Optional<PlayerSessionInfo> found = players.stream()
                        .filter(p -> p.getSessionId().equals(sessionId))
                        .findFirst();
                if (found.isPresent()) {
                    players.remove(found.get());
                    log.debug("BattleRoomManager.removePlayer: roomId={} playerId={} (활성 제거)", roomId, found.get().getPlayerId());
                    return found.get();
                }
            }
        }

        // 큐에서 제거 시도
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue != null) {
            Optional<PlayerSessionInfo> found = queue.stream()
                    .filter(p -> p.getSessionId().equals(sessionId))
                    .findFirst();
            if (found.isPresent()) {
                queue.remove(found.get());
                log.debug("BattleRoomManager.removePlayer: roomId={} playerId={} (큐 제거)", roomId, found.get().getPlayerId());
                return found.get();
            }
        }

        return null;
    }

    /**
     * 특정 playerId로 방에서 플레이어를 찾아 제거.
     */
    public PlayerSessionInfo removePlayerById(String roomId, String playerId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players != null) {
            synchronized (players) {
                Optional<PlayerSessionInfo> found = players.stream()
                        .filter(p -> p.getPlayerId().equals(playerId))
                        .findFirst();
                if (found.isPresent()) {
                    players.remove(found.get());
                    sessionRoomMap.remove(found.get().getSessionId());
                    return found.get();
                }
            }
        }
        return null;
    }

    /**
     * 플레이어를 게임오버 처리 (alive = false, score/rank 설정).
     */
    public void markFinished(String roomId, String playerId, int score, int rank) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players == null) return;
        players.stream()
                .filter(p -> p.getPlayerId().equals(playerId))
                .findFirst()
                .ifPresent(p -> {
                    p.setAlive(false);
                    p.setScore(score);
                    p.setRank(rank);
                });
    }

    /**
     * 큐에서 FIFO 순으로 최대 4인까지 참가자로 승격.
     * @return 승격된 플레이어 목록
     */
    public List<PlayerSessionInfo> promoteFromQueue(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (players == null || queue == null) return Collections.emptyList();

        List<PlayerSessionInfo> promoted = new ArrayList<>();
        synchronized (players) {
            // 기존 참가자를 모두 제거하고 새 라운드 준비
            players.clear();
            // 큐에서 최대 4명 승격
            while (!queue.isEmpty() && players.size() < 4) {
                PlayerSessionInfo p = queue.pollFirst();
                if (p != null) {
                    p.setAlive(true);
                    p.setScore(0);
                    p.setRank(0);
                    p.setVoluntaryLeft(false);
                    players.add(p);
                    promoted.add(p);
                }
            }
        }
        log.debug("BattleRoomManager.promoteFromQueue: roomId={} promoted={}", roomId, promoted.size());
        return promoted;
    }

    /**
     * 다음 라운드를 위해 기존 참가자를 유지하고 큐에서 빈 자리만큼 승격.
     * (전원 재참가 시나리오 — 라운드 종료 후 큐 대기자 합류)
     */
    public List<PlayerSessionInfo> fillFromQueue(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (players == null || queue == null) return Collections.emptyList();

        List<PlayerSessionInfo> promoted = new ArrayList<>();
        synchronized (players) {
            // 기존 참가자 alive 리셋
            players.forEach(p -> {
                p.setAlive(true);
                p.setScore(0);
                p.setRank(0);
                p.setVoluntaryLeft(false);
            });
            // 빈 자리에 큐 승격
            while (!queue.isEmpty() && players.size() < 4) {
                PlayerSessionInfo p = queue.pollFirst();
                if (p != null) {
                    p.setAlive(true);
                    p.setScore(0);
                    p.setRank(0);
                    p.setVoluntaryLeft(false);
                    players.add(p);
                    promoted.add(p);
                }
            }
        }
        return promoted;
    }

    /** 살아있는 플레이어 목록 */
    public List<PlayerSessionInfo> getAlivePlayers(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players == null) return Collections.emptyList();
        return players.stream().filter(PlayerSessionInfo::isAlive).collect(Collectors.toList());
    }

    /** 전체 활성 참가자 목록 (alive/dead 포함) */
    public List<PlayerSessionInfo> getActivePlayers(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players == null) return Collections.emptyList();
        return Collections.unmodifiableList(players);
    }

    /** 큐 대기열 목록 */
    public List<PlayerSessionInfo> getQueuePlayers(String roomId) {
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue == null) return Collections.emptyList();
        return new ArrayList<>(queue);
    }

    /** 큐 크기 */
    public int getQueueSize(String roomId) {
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        return queue == null ? 0 : queue.size();
    }

    /** sessionId → roomId */
    public String getRoomIdBySession(String sessionId) {
        return sessionRoomMap.get(sessionId);
    }

    /**
     * REST join 후 WebSocket 연결 시점에 sessionId 등록.
     * playerId → 기존 PlayerSessionInfo 의 sessionId 를 업데이트한다.
     */
    public void registerSession(String roomId, String playerId, String sessionId) {
        // activePlayers 탐색
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players != null) {
            players.stream()
                    .filter(p -> p.getPlayerId().equals(playerId))
                    .findFirst()
                    .ifPresent(p -> {
                        if (p.getSessionId() != null) {
                            sessionRoomMap.remove(p.getSessionId());
                        }
                        p.setSessionId(sessionId);
                        sessionRoomMap.put(sessionId, roomId);
                    });
            return;
        }
        // 큐에서 탐색
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue != null) {
            queue.stream()
                    .filter(p -> p.getPlayerId().equals(playerId))
                    .findFirst()
                    .ifPresent(p -> {
                        if (p.getSessionId() != null) {
                            sessionRoomMap.remove(p.getSessionId());
                        }
                        p.setSessionId(sessionId);
                        sessionRoomMap.put(sessionId, roomId);
                    });
        }
    }

    /** roomId에 해당 playerId 포함 여부 */
    public boolean isPlayerInRoom(String roomId, String playerId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players != null) {
            if (players.stream().anyMatch(p -> p.getPlayerId().equals(playerId))) return true;
        }
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue != null) {
            return queue.stream().anyMatch(p -> p.getPlayerId().equals(playerId));
        }
        return false;
    }

    /** 플레이어가 속한 활성 roomId 조회 (ALREADY_IN_ROOM 체크용) */
    public Optional<String> findActiveRoomByPlayerId(String playerId) {
        return activePlayers.entrySet().stream()
                .filter(e -> e.getValue().stream().anyMatch(p -> p.getPlayerId().equals(playerId)))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    /** 활성 참가자 단건 조회 */
    public Optional<PlayerSessionInfo> findActivePlayer(String roomId, String playerId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players == null) return Optional.empty();
        return players.stream()
                .filter(p -> p.getPlayerId().equals(playerId))
                .findFirst();
    }

    /** 방 참가자/큐 전체 정리 (방 close 시) */
    public void cleanupRoom(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.remove(roomId);
        if (players != null) {
            players.forEach(p -> sessionRoomMap.remove(p.getSessionId()));
        }
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.remove(roomId);
        if (queue != null) {
            queue.forEach(p -> sessionRoomMap.remove(p.getSessionId()));
        }
        log.debug("BattleRoomManager.cleanupRoom: roomId={} 정리 완료", roomId);
    }

    /**
     * 게임 종료 후 다음 라운드를 위한 상태 초기화 (참가자 alive 리셋).
     * 큐 대기자는 유지.
     */
    public void resetForNextRound(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players != null) {
            synchronized (players) {
                players.forEach(p -> {
                    p.setAlive(true);
                    p.setScore(0);
                    p.setRank(0);
                    p.setVoluntaryLeft(false);
                });
            }
        }
    }
}
