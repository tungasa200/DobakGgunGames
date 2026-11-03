package com.dobakggun.service;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 블록폴 배틀 인메모리 방 상태 관리 컴포넌트.
 * PRD §14.1 — 단일 인스턴스 인메모리 운영 (Redis 미사용).
 */
@Slf4j
@Component
public class BattleRoomManager {

    private static final int MAX_PLAYERS = 5;

    // ─── 인메모리 저장소 ──────────────────────────────────────────────────────

    /** roomId → 참가자 목록 */
    private final ConcurrentHashMap<String, List<PlayerSessionInfo>> activePlayers = new ConcurrentHashMap<>();

    /** roomId → 대기열 (FIFO) */
    private final ConcurrentHashMap<String, LinkedBlockingDeque<PlayerSessionInfo>> queues = new ConcurrentHashMap<>();

    /** sessionId → roomId 역방향 조회 */
    private final ConcurrentHashMap<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    /** roomId → 준비 완료한 playerId Set */
    private final ConcurrentHashMap<String, Set<String>> readySets = new ConcurrentHashMap<>();

    /** 게임 중이거나 결과 화면인 방. 새로 들어온 사람은 활성 참가자가 아니라 큐로 간다(PRD §5.2). */
    private final Set<String> closedToJoin = ConcurrentHashMap.newKeySet();

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
        /** 큐에서 다음 라운드를 기다리는 중. 게임 메시지를 보낼 수 없다. */
        private volatile boolean queued;
        /** T48-RISK1: WS 가 끊겨 재연결 유예 중. 혼자 남음·전원 준비·카운트다운·게임 시작 판정에서 빼고 센다. */
        private volatile boolean disconnected;

        // ─── 새로고침 복원용 보드 스냅샷 캐시 ──────────────────────────────
        // 클라이언트가 200ms 주기로 송신하는 BOARD_UPDATE 의 마지막 값.
        // GAME_STARTED 시 clearGameStateCache() 호출로 초기화.
        private volatile int[][] lastBoard;
        private volatile int lastLines;
        private volatile int lastLevel;
        private volatile int lastCombo;
        private volatile boolean hasGameStateCache;

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
            this.hasGameStateCache = false;
        }

        /** 게임 시작 시 호출 — 이전 라운드 잔여 캐시 제거 */
        public void clearGameStateCache() {
            this.lastBoard = null;
            this.lastLines = 0;
            this.lastLevel = 1;
            this.lastCombo = 0;
            this.hasGameStateCache = false;
        }

        /** BOARD_UPDATE 수신 시 호출 — 최신 스냅샷 갱신 */
        public void updateGameStateCache(int[][] board, int score, int lines, int level, int combo) {
            this.lastBoard = board;
            this.score = score;
            this.lastLines = lines;
            this.lastLevel = level;
            this.lastCombo = combo;
            this.hasGameStateCache = true;
        }
    }

    // ─── 공개 API ────────────────────────────────────────────────────────────

    /**
     * 방에 참가자를 추가한다.
     * @return true: 즉시 참가, false: 큐에 진입
     */
    public boolean joinRoom(String roomId, PlayerSessionInfo player) {
        return joinRoom(roomId, player, true);
    }

    /**
     * 방에 참가자를 추가한다. 정원이 찼거나 게임 중·결과 화면이면 활성 참가자가 될 수 없다.
     * @param allowQueue false 면 활성 참가가 안 될 때 큐에도 넣지 않는다(방 직접 입장)
     * @return true: 즉시 참가, false: 큐에 진입했거나(allowQueue) 입장 불가
     */
    public boolean joinRoom(String roomId, PlayerSessionInfo player, boolean allowQueue) {
        activePlayers.putIfAbsent(roomId, new CopyOnWriteArrayList<>());
        queues.putIfAbsent(roomId, new LinkedBlockingDeque<>());

        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        synchronized (players) {
            if (!closedToJoin.contains(roomId) && players.size() < MAX_PLAYERS) {
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
        if (!allowQueue) return false;
        // 정원 초과 또는 진행 중 → 큐 진입
        player.setQueued(true);
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
                        .filter(p -> sessionId.equals(p.getSessionId()))
                        .findFirst();
                if (found.isPresent()) {
                    players.remove(found.get());
                    clearReady(roomId, found.get().getPlayerId());
                    log.debug("BattleRoomManager.removePlayer: roomId={} playerId={} (활성 제거)", roomId, found.get().getPlayerId());
                    return found.get();
                }
            }
        }

        // 큐에서 제거 시도
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue != null) {
            Optional<PlayerSessionInfo> found = queue.stream()
                    .filter(p -> sessionId.equals(p.getSessionId()))
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
                    clearReady(roomId, playerId);
                    removeSessionMapping(found.get());
                    return found.get();
                }
            }
        }
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue != null) {
            Optional<PlayerSessionInfo> found = queue.stream()
                    .filter(p -> p.getPlayerId().equals(playerId))
                    .findFirst();
            if (found.isPresent() && queue.remove(found.get())) {
                removeSessionMapping(found.get());
                return found.get();
            }
        }
        return null;
    }

    private void removeSessionMapping(PlayerSessionInfo player) {
        if (player.getSessionId() != null) {
            sessionRoomMap.remove(player.getSessionId());
        }
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
            while (!queue.isEmpty() && players.size() < MAX_PLAYERS) {
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
            while (!queue.isEmpty() && players.size() < MAX_PLAYERS) {
                PlayerSessionInfo p = queue.pollFirst();
                if (p != null) {
                    p.setAlive(true);
                    p.setScore(0);
                    p.setRank(0);
                    p.setVoluntaryLeft(false);
                    p.setQueued(false);
                    players.add(p);
                    promoted.add(p);
                }
            }
            // 다음 라운드 대기(WAITING) — 다시 활성 참가를 받는다
            closedToJoin.remove(roomId);
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

    /** 끊김 유예 중이 아닌 활성 참가자 (T48-RISK1). WS 연결 전(sessionId == null)인 참가자는 포함한다. */
    public List<PlayerSessionInfo> getConnectedPlayers(String roomId) {
        return getActivePlayers(roomId).stream()
                .filter(p -> !p.isDisconnected())
                .collect(Collectors.toList());
    }

    /** 끊김 유예 중이 아닌 활성 참가자 가운데 준비한 사람 수 */
    public int getConnectedReadyCount(String roomId) {
        Set<String> ready = readySets.getOrDefault(roomId, Collections.emptySet());
        return (int) getConnectedPlayers(roomId).stream()
                .filter(p -> ready.contains(p.getPlayerId()))
                .count();
    }

    /**
     * WS 끊김 — 그 세션의 참가자(활성 또는 큐)를 유예 중으로 표시한다.
     * 이미 재연결해 세션이 바뀌었으면 매핑이 없어 아무것도 하지 않는다.
     */
    public void markDisconnected(String sessionId) {
        String roomId = sessionRoomMap.get(sessionId);
        if (roomId == null) return;
        Stream.concat(getActivePlayers(roomId).stream(), getQueuePlayers(roomId).stream())
                .filter(p -> sessionId.equals(p.getSessionId()))
                .findFirst()
                .ifPresent(p -> p.setDisconnected(true));
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
     * @return 끊김 유예 중이던 사람이 돌아왔으면 true
     */
    public boolean registerSession(String roomId, String playerId, String sessionId) {
        // 활성 참가자에 없으면 큐에서 찾는다 — 큐 사용자도 끊김·퇴장 처리를 받아야 한다
        return findPlayer(roomId, playerId).map(p -> {
            boolean wasDisconnected = p.isDisconnected();
            removeSessionMapping(p);
            p.setSessionId(sessionId);
            p.setDisconnected(false);
            sessionRoomMap.put(sessionId, roomId);
            return wasDisconnected;
        }).orElse(false);
    }

    /** roomId에 해당 playerId 포함 여부 */
    public boolean isPlayerInRoom(String roomId, String playerId) {
        return findPlayer(roomId, playerId).isPresent();
    }

    /** 플레이어가 있는 방의 수. */
    public int getActiveRoomCount() {
        return (int) activePlayers.entrySet().stream()
                .filter(e -> !e.getValue().isEmpty())
                .count();
    }

    /** 모든 방의 전체 플레이어 수. */
    public int getActiveTotalPlayerCount() {
        return activePlayers.values().stream()
                .mapToInt(List::size)
                .sum();
    }

    /** 플레이어가 활성 참가자나 큐로 속한 roomId 조회 (ALREADY_IN_ROOM 체크·WS 세션 등록용) */
    public Optional<String> findRoomIdByPlayerId(String playerId) {
        // joinRoom 이 activePlayers 와 queues 키를 함께 만들고 cleanupRoom 이 함께 지운다
        return queues.keySet().stream()
                .filter(roomId -> findPlayer(roomId, playerId).isPresent())
                .findFirst();
    }

    /** 활성 참가자 또는 큐 대기자 단건 조회 */
    public Optional<PlayerSessionInfo> findPlayer(String roomId, String playerId) {
        Optional<PlayerSessionInfo> active = findActivePlayer(roomId, playerId);
        if (active.isPresent()) return active;
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.get(roomId);
        if (queue == null) return Optional.empty();
        return queue.stream()
                .filter(p -> p.getPlayerId().equals(playerId))
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

    /**
     * 게임 시작 — 이후 들어오는 사람은 큐로 간다. 같은 락 안에서 이번 판의 참가자(연결된 사람)를 돌려준다.
     * 연결된 사람이 2명 이상이면 끊김 유예 중인 사람은 판에 넣지 않고 큐 앞으로 옮긴다(T48-RISK1) —
     * 유예 안에 재연결하면 다음 라운드에 들어가고, 유예가 끝나면 큐에서 정리된다.
     * 다음 라운드 승격(fillFromQueue)에서 다시 연다.
     */
    public List<PlayerSessionInfo> closeToJoin(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.get(roomId);
        if (players == null) return Collections.emptyList();
        synchronized (players) {
            closedToJoin.add(roomId);
            List<PlayerSessionInfo> connected = players.stream()
                    .filter(p -> !p.isDisconnected())
                    .collect(Collectors.toList());
            if (connected.size() < 2) return connected;
            List<PlayerSessionInfo> ghosts = players.stream()
                    .filter(PlayerSessionInfo::isDisconnected)
                    .toList();
            LinkedBlockingDeque<PlayerSessionInfo> queue = queues.computeIfAbsent(roomId, k -> new LinkedBlockingDeque<>());
            // 큐에 먼저 넣고 활성에서 뺀다 — removePlayer 가 어느 쪽에서든 찾을 수 있게
            for (int i = ghosts.size() - 1; i >= 0; i--) {
                PlayerSessionInfo ghost = ghosts.get(i);
                ghost.setQueued(true);
                queue.offerFirst(ghost);
                players.remove(ghost);
                clearReady(roomId, ghost.getPlayerId());
            }
            return connected;
        }
    }

    /** 시작 직전 인원이 2명 미만으로 줄어 시작을 취소할 때 다시 연다. */
    public void reopenToJoin(String roomId) {
        closedToJoin.remove(roomId);
    }

    /** 방 참가자/큐 전체 정리 (방 close 시) */
    public void cleanupRoom(String roomId) {
        List<PlayerSessionInfo> players = activePlayers.remove(roomId);
        if (players != null) {
            players.forEach(this::removeSessionMapping);
        }
        LinkedBlockingDeque<PlayerSessionInfo> queue = queues.remove(roomId);
        if (queue != null) {
            queue.forEach(this::removeSessionMapping);
        }
        readySets.remove(roomId);
        closedToJoin.remove(roomId);
        log.debug("BattleRoomManager.cleanupRoom: roomId={} 정리 완료", roomId);
    }

    /**
     * 플레이어 준비 완료 등록.
     * @return true: 전원 준비(2인 이상) → 다음 라운드 시작 가능
     */
    public boolean markPlayerReady(String roomId, String playerId) {
        readySets.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(playerId);
        int activeCount = getActivePlayers(roomId).size();
        int readyCount = readySets.getOrDefault(roomId, Collections.emptySet()).size();
        return activeCount >= 2 && readyCount >= activeCount;
    }

    public int getReadyCount(String roomId) {
        return readySets.getOrDefault(roomId, Collections.emptySet()).size();
    }

    public void clearReadySet(String roomId) {
        readySets.remove(roomId);
    }

    /** 나간 멤버의 준비가 남으면 남은 사람이 준비하기 전에 다음 라운드가 열린다. */
    private void clearReady(String roomId, String playerId) {
        Set<String> ready = readySets.get(roomId);
        if (ready != null) {
            ready.remove(playerId);
        }
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
