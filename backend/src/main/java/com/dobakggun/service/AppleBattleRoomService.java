package com.dobakggun.service;

import com.dobakggun.domain.apple.AppleBattleRoom;
import com.dobakggun.domain.apple.AppleBattleRoom.PlayerInfo;
import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.apple.AppleBattleJoinResponse;
import com.dobakggun.dto.apple.WsAppleBattleMessage;
import com.dobakggun.entity.User;
import com.dobakggun.entity.apple.AppleBattleRecord;
import com.dobakggun.repository.AppleBattleRecordRepository;
import com.dobakggun.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

/**
 * 사과게임 배틀 핵심 게임 로직 서비스.
 * MinesweeperBattleRoomService 와 완전히 독립적 — 공유 상태 없음.
 *
 * <p>게임 규칙:
 * <ul>
 *   <li>2명이 동일한 10×17 보드를 공유 (서버 생성)</li>
 *   <li>한 플레이어가 합=10인 셀 묶음 제거 → 서버 보드 반영 → 양쪽 브로드캐스트</li>
 *   <li>동시 요청: ReentrantLock 으로 처리, 이미 제거된 셀은 CELLS_ALREADY_REMOVED 에러</li>
 *   <li>120초 타이머 → GAME_RESULT (reason: TIME_UP)</li>
 *   <li>보드 클리어 시 즉시 GAME_RESULT (reason: BOARD_CLEARED)</li>
 *   <li>상대 이탈 시 남은 플레이어 승리 (reason: OPPONENT_LEFT)</li>
 * </ul>
 */
@Slf4j
@Service
public class AppleBattleRoomService {

    // ─── 상수 ─────────────────────────────────────────────────────────────────

    private static final int RECONNECT_GRACE_SECONDS = 30;
    private static final int ROOM_CLOSE_DELAY_SECONDS = 60;
    private static final int GAME_DURATION_SECONDS = 120;
    private static final int COUNTDOWN_SECONDS = 3;

    static final String TOPIC_PREFIX = "/topic/apple-battle/room/";
    static final String USER_QUEUE_BOARD = "/queue/apple-battle/board";
    static final String USER_QUEUE_STATE = "/queue/apple-battle/state";
    static final String USER_QUEUE_ERRORS = "/queue/apple-battle/errors";

    // ─── 보드 생성 상수 (AppleSessionService 와 동일) ─────────────────────────

    private static final int ROWS = AppleBattleRoom.ROWS;   // 10
    private static final int COLS = AppleBattleRoom.COLS;   // 17
    /** 1~9 각 숫자의 가중치 (프론트엔드 APPLE_WEIGHTS 와 동일) */
    private static final int[] WEIGHTS = {5, 5, 4, 4, 3, 3, 2, 2, 1};
    private static final int WEIGHT_TOTAL;

    static {
        int sum = 0;
        for (int w : WEIGHTS) sum += w;
        WEIGHT_TOTAL = sum;
    }

    // ─── 의존성 ───────────────────────────────────────────────────────────────

    private final AppleBattleRoomManager roomManager;
    private final AppleBattleRecordRepository appleBattleRecordRepository;
    private final UserRepository userRepository;
    private final ThreadPoolTaskScheduler taskScheduler;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public AppleBattleRoomService(
            AppleBattleRoomManager roomManager,
            AppleBattleRecordRepository appleBattleRecordRepository,
            UserRepository userRepository,
            @Qualifier("battleTaskScheduler") ThreadPoolTaskScheduler taskScheduler) {
        this.roomManager = roomManager;
        this.appleBattleRecordRepository = appleBattleRecordRepository;
        this.userRepository = userRepository;
        this.taskScheduler = taskScheduler;
    }

    // ─── 매칭 ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/apple-battle/join 에서 호출.
     * WAITING 방(1명) 탐색 → 없으면 신규 방 생성.
     */
    @Transactional
    public AppleBattleJoinResponse joinOrCreate(Long userId, String guestToken, String nickname) {
        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        // 중복 참가 방지
        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                AppleBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                if (existing != null && existing.getStatus() == AppleBattleRoom.Status.FINISHED) {
                    ScheduledFuture<?> df = existing.getDisconnectFutures().remove(playerId);
                    if (df != null && !df.isDone()) df.cancel(false);
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get(), playerId);
                }
            }
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);

        // WAITING 방 탐색
        Optional<AppleBattleRoom> waitingRoom = roomManager.findWaitingRoom();

        if (waitingRoom.isPresent()) {
            AppleBattleRoom room = waitingRoom.get();
            ReentrantLock lock = roomManager.getRoomLock(room.getRoomId());
            lock.lock();
            try {
                if (room.getPlayerCount() >= 2 || room.getStatus() != AppleBattleRoom.Status.WAITING) {
                    lock.unlock();
                    return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
                }

                boolean joined = roomManager.addPlayer(room.getRoomId(), newPlayer);
                if (!joined) {
                    lock.unlock();
                    return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
                }

                // 2명 완성 → MATCHED 상태 전이
                room.setStatus(AppleBattleRoom.Status.MATCHED);
                room.setMatchedAt(Instant.now());

                lock.unlock();

                // 2번째 플레이어가 WS 연결됐을 때 MATCH_READY 를 보내므로
                // 여기서는 상태만 MATCHED 로 변경

                PlayerInfo firstPlayer = room.getPlayers().get(0);
                return AppleBattleJoinResponse.builder()
                        .roomId(room.getRoomId())
                        .playerId(playerId)
                        .isGuest(isGuest)
                        .guestToken(isGuest ? guestToken : null)
                        .status("MATCHED")
                        .playerCount(2)
                        .maxPlayers(2)
                        .opponentNickname(firstPlayer.getNickname())
                        .build();

            } catch (Exception e) {
                if (lock.isHeldByCurrentThread()) lock.unlock();
                throw e;
            }
        }

        return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
    }

    /** POST /api/apple-battle/create — 신규 방 직접 생성 (자동 합류 없음). */
    @Transactional
    public AppleBattleJoinResponse createRoomOnly(Long userId, String guestToken, String nickname) {
        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                AppleBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                if (existing != null && existing.getStatus() == AppleBattleRoom.Status.FINISHED) {
                    ScheduledFuture<?> df = existing.getDisconnectFutures().remove(playerId);
                    if (df != null && !df.isDone()) df.cancel(false);
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get(), playerId);
                }
            }
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);
        return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
    }

    /** POST /api/apple-battle/join/{roomId} — 특정 방에 직접 입장. */
    @Transactional
    public AppleBattleJoinResponse joinSpecificRoom(String roomId, Long userId, String guestToken, String nickname) {
        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                AppleBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                if (existing != null && existing.getStatus() == AppleBattleRoom.Status.FINISHED) {
                    ScheduledFuture<?> df = existing.getDisconnectFutures().remove(playerId);
                    if (df != null && !df.isDone()) df.cancel(false);
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get(), playerId);
                }
            }
        }

        AppleBattleRoom room = roomManager.getRoom(roomId)
                .orElseThrow(RoomNotFoundException::new);

        if (room.getStatus() != AppleBattleRoom.Status.WAITING || room.getPlayerCount() >= 2) {
            throw new RoomFullOrStartedException();
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);

        ReentrantLock lock = roomManager.getRoomLock(roomId);
        lock.lock();
        try {
            if (room.getPlayerCount() >= 2 || room.getStatus() != AppleBattleRoom.Status.WAITING) {
                throw new RoomFullOrStartedException();
            }

            boolean joined = roomManager.addPlayer(roomId, newPlayer);
            if (!joined) {
                throw new RoomFullOrStartedException();
            }

            room.setStatus(AppleBattleRoom.Status.MATCHED);
            room.setMatchedAt(Instant.now());

            lock.unlock();

            PlayerInfo firstPlayer = room.getPlayers().get(0);
            return AppleBattleJoinResponse.builder()
                    .roomId(roomId)
                    .playerId(playerId)
                    .isGuest(isGuest)
                    .guestToken(isGuest ? guestToken : null)
                    .status("MATCHED")
                    .playerCount(2)
                    .maxPlayers(2)
                    .opponentNickname(firstPlayer.getNickname())
                    .build();

        } catch (Exception e) {
            if (lock.isHeldByCurrentThread()) lock.unlock();
            throw e;
        }
    }

    /** WAITING 방 취소 (REST 폴백). */
    public boolean cancelWaiting(String roomId, String playerId) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return false;
        if (room.findPlayer(playerId) == null) return false;
        if (room.getStatus() != AppleBattleRoom.Status.WAITING) return false;

        log.info("cancelWaiting(REST): roomId={} playerId={}", roomId, playerId);
        room.setStatus(AppleBattleRoom.Status.FINISHED);
        roomManager.closeRoom(roomId);
        return true;
    }

    /** WAITING 방 목록 반환. */
    public List<WaitingRoomInfo> listWaitingRooms() {
        return roomManager.getWaitingRooms().stream()
                .map(room -> {
                    String hostNickname = room.getPlayers().isEmpty()
                            ? null
                            : room.getPlayers().get(0).getNickname();
                    return WaitingRoomInfo.builder()
                            .roomId(room.getRoomId())
                            .currentPlayers(room.getPlayerCount())
                            .maxPlayers(2)
                            .hostNickname(hostNickname)
                            .createdAt(null)
                            .difficulty(null)
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ─── WebSocket 핸들러 ──────────────────────────────────────────────────────

    /**
     * SessionConnectedEvent 에서 호출.
     * 방에 플레이어가 배정된 경우 sessionId 등록.
     * 2명 모두 WS 연결됐을 때 MATCH_READY → 3초 후 GAME_STARTED.
     */
    public void handleConnect(String playerId, String sessionId) {
        Optional<String> roomIdOpt = roomManager.findRoomIdByPlayer(playerId);
        if (roomIdOpt.isEmpty()) return;

        String roomId = roomIdOpt.get();
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        boolean wasDisconnected = player.isDisconnected();
        roomManager.registerSession(roomId, playerId, sessionId);

        if (wasDisconnected) {
            // 재연결
            handleReconnect(roomId, playerId, sessionId);
            return;
        }

        log.debug("handleConnect: roomId={} playerId={} sessionId={}", roomId, playerId, sessionId);

        // MATCHED 상태에서 양쪽 모두 연결됐으면 MATCH_READY 발송
        if (room.getStatus() == AppleBattleRoom.Status.MATCHED) {
            boolean allConnected = room.getPlayers().stream().allMatch(PlayerInfo::isConnected);
            if (allConnected && room.getPlayers().size() == 2) {
                sendMatchReadyAndScheduleStart(room);
            }
        }
    }

    /**
     * 사과 제거 처리 — 핵심 메서드.
     *
     * <ol>
     *   <li>방 lock 획득</li>
     *   <li>cells가 모두 보드에 존재하는지 확인 (null 이 아닌지)</li>
     *   <li>cells 값의 합이 10인지 서버에서 검증</li>
     *   <li>유효하면: 해당 셀들 null로 설정, 점수 += cells.size()</li>
     *   <li>APPLE_REMOVED 브로드캐스트</li>
     *   <li>보드 전체 클리어 확인 → GAME_RESULT</li>
     *   <li>유효하지 않으면: 해당 플레이어에게 ERROR 전송</li>
     * </ol>
     */
    public void handleRemove(String roomId, String playerId, List<List<Integer>> cells) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) {
            sendError(playerId, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
            return;
        }

        if (room.getStatus() != AppleBattleRoom.Status.PLAYING) {
            sendError(playerId, "GAME_NOT_PLAYING", "게임이 진행 중이 아닙니다.");
            return;
        }

        if (room.findPlayer(playerId) == null) {
            sendError(playerId, "NOT_IN_ROOM", "해당 방에 참가하지 않았습니다.");
            return;
        }

        if (cells == null || cells.isEmpty()) {
            sendError(playerId, "INVALID_CELLS", "셀 목록이 비어있습니다.");
            return;
        }

        ReentrantLock lock = room.getLock();
        lock.lock();
        try {
            Integer[][] board = room.getBoard();
            if (board == null) {
                sendError(playerId, "BOARD_NOT_READY", "보드가 준비되지 않았습니다.");
                return;
            }

            // 1. 셀 유효성 검증 — 모두 보드에 존재하는지 (null 이 아닌지)
            List<int[]> validCells = new ArrayList<>();
            for (List<Integer> cell : cells) {
                if (cell == null || cell.size() < 2) {
                    sendError(playerId, "INVALID_CELLS", "셀 좌표 형식이 올바르지 않습니다.");
                    return;
                }
                int r = cell.get(0);
                int c = cell.get(1);

                if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
                    sendError(playerId, "INVALID_CELLS", "셀 좌표가 범위를 벗어났습니다.");
                    return;
                }

                if (board[r][c] == null) {
                    // 이미 제거된 셀 포함 — CELLS_ALREADY_REMOVED 에러
                    sendError(playerId, "CELLS_ALREADY_REMOVED",
                            "이미 제거된 셀이 포함되어 있습니다. (" + r + "," + c + ")");
                    return;
                }
                validCells.add(new int[]{r, c});
            }

            // 2. 합이 10인지 서버에서 검증
            int sum = 0;
            for (int[] rc : validCells) {
                sum += board[rc[0]][rc[1]];
            }
            if (sum != 10) {
                sendError(playerId, "INVALID_SUM", "선택한 셀의 합이 10이 아닙니다. (합=" + sum + ")");
                return;
            }

            // 3. 셀 제거 — board에서 null 처리
            List<List<Integer>> removedCells = new ArrayList<>();
            for (int[] rc : validCells) {
                board[rc[0]][rc[1]] = null;
                removedCells.add(List.of(rc[0], rc[1]));
            }

            // 4. 점수 증가
            room.getScores().merge(playerId, validCells.size(), Integer::sum);
            int newScore = room.getScores().get(playerId);

            log.debug("handleRemove: roomId={} playerId={} cells={} score={}", roomId, playerId, validCells.size(), newScore);

            // 5. APPLE_REMOVED 브로드캐스트
            Map<String, Object> removePayload = new LinkedHashMap<>();
            removePayload.put("playerId", playerId);
            removePayload.put("cells", removedCells);
            Map<String, Integer> scoresSnapshot = new HashMap<>(room.getScores());
            removePayload.put("scores", scoresSnapshot);
            broadcast(roomId, "APPLE_REMOVED", removePayload);

            // 6. 보드 완전 클리어 확인
            if (room.isBoardCleared()) {
                log.info("handleRemove: 보드 완전 클리어 roomId={}", roomId);
                if (room.getFinished().compareAndSet(false, true)) {
                    String winnerId = determineWinner(room);
                    finishGame(room, winnerId, "BOARD_CLEARED");
                }
            }

        } finally {
            lock.unlock();
        }
    }

    /**
     * REQUEST_STATE 수신 — 재연결 후 상태 복원.
     */
    public void handleRequestState(String roomId, String playerId) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) {
            sendError(playerId, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
            return;
        }

        Map<String, Object> snapshot = buildStateSnapshot(room, playerId);
        messagingTemplate.convertAndSendToUser(
                playerId, USER_QUEUE_STATE, buildEnvelope("STATE_SNAPSHOT", snapshot));

        log.debug("handleRequestState: roomId={} playerId={}", roomId, playerId);
    }

    /**
     * LEAVE 수신 — 자발적 이탈.
     */
    public void handleLeave(String roomId, String playerId) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player != null) {
            player.setVoluntaryLeft(true);
        }

        log.info("handleLeave: roomId={} playerId={}", roomId, playerId);

        if (room.getStatus() == AppleBattleRoom.Status.PLAYING
                || room.getStatus() == AppleBattleRoom.Status.MATCHED) {
            if (room.getFinished().compareAndSet(false, true)) {
                PlayerInfo opponent = room.findOpponent(playerId);
                String winnerId = (opponent != null) ? opponent.getPlayerId() : playerId;
                finishGame(room, winnerId, "OPPONENT_LEFT");
            }
        } else if (room.getStatus() == AppleBattleRoom.Status.WAITING) {
            room.setStatus(AppleBattleRoom.Status.FINISHED);
            cancelGameTimers(room);
            roomManager.closeRoom(roomId);
        } else if (room.getStatus() == AppleBattleRoom.Status.FINISHED) {
            // 게임 종료 후 이탈 — 재대결 대기 중인 상대에게 REMATCH_DECLINED
            PlayerInfo opponent = room.findOpponent(playerId);
            if (opponent != null && opponent.getPlayerId() != null
                    && room.getRematchRequested().containsKey(opponent.getPlayerId())) {
                messagingTemplate.convertAndSendToUser(
                        opponent.getPlayerId(), USER_QUEUE_STATE,
                        buildEnvelope("REMATCH_DECLINED", Map.of("reason", "OPPONENT_LEFT")));
            }
        }
    }

    /**
     * SessionDisconnectEvent 에서 호출.
     * 30초 grace period — 재연결 안 하면 상대 승리.
     */
    public void handleDisconnect(String sessionId) {
        String roomId = roomManager.findRoomIdBySession(sessionId).orElse(null);
        if (roomId == null) return;

        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayerBySession(sessionId);
        if (player == null) return;

        String playerId = player.getPlayerId();
        roomManager.unregisterSession(sessionId);

        // FINISHED 방 — 재대결 대기 중인 상대에게 REMATCH_DECLINED 발송 후 종료
        if (room.getStatus() == AppleBattleRoom.Status.FINISHED) {
            PlayerInfo finishedOpponent = room.findOpponent(playerId);
            if (finishedOpponent != null && finishedOpponent.getPlayerId() != null
                    && room.getRematchRequested().containsKey(finishedOpponent.getPlayerId())) {
                messagingTemplate.convertAndSendToUser(
                        finishedOpponent.getPlayerId(), USER_QUEUE_STATE,
                        buildEnvelope("REMATCH_DECLINED", Map.of("reason", "OPPONENT_LEFT")));
            }
            return;
        }

        log.info("handleDisconnect: roomId={} playerId={} — grace period {}초 시작", roomId, playerId, RECONNECT_GRACE_SECONDS);

        // 상대에게 OPPONENT_DISCONNECTED 전송
        PlayerInfo opponent = room.findOpponent(playerId);
        if (opponent != null && opponent.getPlayerId() != null) {
            Instant gracePeriodEndsAt = Instant.now().plusSeconds(RECONNECT_GRACE_SECONDS);
            Map<String, Object> disconnPayload = Map.of(
                    "opponentId", playerId,
                    "gracePeriodMs", RECONNECT_GRACE_SECONDS * 1000,
                    "gracePeriodEndsAt", gracePeriodEndsAt.atZone(ZoneOffset.UTC)
                            .format(DateTimeFormatter.ISO_INSTANT)
            );
            messagingTemplate.convertAndSendToUser(
                    opponent.getPlayerId(), USER_QUEUE_STATE,
                    buildEnvelope("OPPONENT_DISCONNECTED", disconnPayload));
        }

        // grace period 만료 → 상대 승리
        final String capturedPlayerId = playerId;
        ScheduledFuture<?> graceFuture = taskScheduler.schedule(() -> {
            AppleBattleRoom r = roomManager.getRoom(roomId).orElse(null);
            if (r == null) return;

            PlayerInfo p = r.findPlayer(capturedPlayerId);
            if (p == null || !p.isDisconnected()) {
                log.debug("grace period 만료 but 재연결 됨: roomId={} playerId={}", roomId, capturedPlayerId);
                return;
            }

            log.info("grace period 만료 → 상대 승리: roomId={} playerId={}", roomId, capturedPlayerId);

            if (r.getFinished().compareAndSet(false, true)) {
                PlayerInfo opp = r.findOpponent(capturedPlayerId);
                String winnerId = (opp != null) ? opp.getPlayerId() : capturedPlayerId;
                finishGame(r, winnerId, "OPPONENT_LEFT");
            }
        }, Instant.now().plusSeconds(RECONNECT_GRACE_SECONDS));

        room.getDisconnectFutures().put(playerId, graceFuture);
    }

    /**
     * 재연결 시 호출 — grace period 취소, 상대에게 OPPONENT_RECONNECTED 전송.
     */
    public void handleReconnect(String roomId, String playerId, String newSessionId) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return;

        ScheduledFuture<?> graceFuture = room.getDisconnectFutures().remove(playerId);
        if (graceFuture != null && !graceFuture.isDone()) {
            graceFuture.cancel(false);
        }

        roomManager.registerSession(roomId, playerId, newSessionId);

        PlayerInfo opponent = room.findOpponent(playerId);
        if (opponent != null && opponent.getPlayerId() != null) {
            messagingTemplate.convertAndSendToUser(
                    opponent.getPlayerId(), USER_QUEUE_STATE,
                    buildEnvelope("OPPONENT_RECONNECTED", Map.of("opponentId", playerId)));
        }

        log.info("handleReconnect: roomId={} playerId={} newSessionId={}", roomId, playerId, newSessionId);
    }

    /**
     * REMATCH 수신 — 재대결 요청.
     */
    public void handleRematch(String roomId, String playerId) {
        AppleBattleRoom room = roomManager.getRoom(roomId).orElse(null);
        if (room == null) return;
        if (room.findPlayer(playerId) == null) return;
        if (room.getStatus() != AppleBattleRoom.Status.FINISHED) return;

        room.getRematchRequested().put(playerId, Boolean.TRUE);
        log.info("handleRematch: roomId={} playerId={} rematchCount={}", roomId, playerId, room.getRematchRequested().size());

        PlayerInfo opponent = room.findOpponent(playerId);

        if (room.getRematchRequested().size() < 2) {
            // 상대가 이미 연결 끊긴 경우
            if (opponent != null && (opponent.isDisconnected() || opponent.isVoluntaryLeft())) {
                room.getRematchRequested().remove(playerId);
                messagingTemplate.convertAndSendToUser(
                        playerId, USER_QUEUE_STATE,
                        buildEnvelope("REMATCH_DECLINED", Map.of("reason", "OPPONENT_LEFT")));
                return;
            }
            // 방 close 타이머 연장
            ScheduledFuture<?> closeFuture = room.getCloseRoomFuture();
            if (closeFuture != null && !closeFuture.isDone()) {
                closeFuture.cancel(false);
                String rid = room.getRoomId();
                ScheduledFuture<?> extendedFuture = taskScheduler.schedule(
                        () -> roomManager.closeRoom(rid),
                        Instant.now().plusSeconds(ROOM_CLOSE_DELAY_SECONDS));
                room.setCloseRoomFuture(extendedFuture);
            }
            if (opponent != null && opponent.getPlayerId() != null) {
                messagingTemplate.convertAndSendToUser(
                        opponent.getPlayerId(), USER_QUEUE_STATE,
                        buildEnvelope("REMATCH_REQUESTED", Map.of("requesterId", playerId)));
            }
            return;
        }

        // 둘 다 요청 → 방 리셋
        resetRoomForRematch(room);
    }

    // ─── 방 리셋 (재대결) ────────────────────────────────────────────────────

    private void resetRoomForRematch(AppleBattleRoom room) {
        String roomId = room.getRoomId();

        ScheduledFuture<?> closeFuture = room.getCloseRoomFuture();
        if (closeFuture != null && !closeFuture.isDone()) closeFuture.cancel(false);
        room.setCloseRoomFuture(null);

        room.getFinished().set(false);
        room.setStatus(AppleBattleRoom.Status.MATCHED);
        room.getRematchRequested().clear();
        room.getScores().clear();

        // 점수 초기화
        for (PlayerInfo p : room.getPlayers()) {
            room.getScores().put(p.getPlayerId(), 0);
            p.setVoluntaryLeft(false);
            p.setDisconnected(false);
        }

        // 새 보드 생성
        room.setBoard(generateBoard());
        room.setMatchedAt(Instant.now());

        // MATCH_READY → 3초 후 GAME_STARTED
        sendMatchReadyAndScheduleStart(room);

        log.info("resetRoomForRematch: roomId={}", roomId);
    }

    // ─── 게임 시작 ────────────────────────────────────────────────────────────

    /**
     * MATCHED 상태에서 양쪽 WS 연결 확인 후 MATCH_READY 발송 + 3초 카운트다운 스케줄.
     */
    private void sendMatchReadyAndScheduleStart(AppleBattleRoom room) {
        String roomId = room.getRoomId();

        // MATCH_READY 브로드캐스트
        List<Map<String, Object>> playerList = room.getPlayers().stream()
                .map(p -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id", p.getPlayerId());
                    entry.put("nickname", p.getNickname());
                    entry.put("isGuest", p.isGuest());
                    return entry;
                })
                .collect(Collectors.toList());

        broadcast(roomId, "MATCH_READY", Map.of("players", playerList));

        // 기존 카운트다운 취소
        ScheduledFuture<?> existingCountdown = room.getCountdownFuture();
        if (existingCountdown != null && !existingCountdown.isDone()) {
            existingCountdown.cancel(false);
        }

        // 3초 후 GAME_STARTED 발송 + 120초 타이머 등록
        ScheduledFuture<?> countdownFuture = taskScheduler.schedule(() -> {
            AppleBattleRoom r = roomManager.getRoom(roomId).orElse(null);
            if (r == null) return;
            if (r.getStatus() != AppleBattleRoom.Status.MATCHED) return;

            startGame(r);
        }, Instant.now().plusSeconds(COUNTDOWN_SECONDS));

        room.setCountdownFuture(countdownFuture);
        log.info("sendMatchReadyAndScheduleStart: roomId={} — {}초 후 게임 시작", roomId, COUNTDOWN_SECONDS);
    }

    /**
     * 게임 시작 — 보드 생성 + GAME_STARTED 개인 채널 전송 + 120초 타이머.
     */
    private void startGame(AppleBattleRoom room) {
        String roomId = room.getRoomId();

        Integer[][] board = generateBoard();
        room.setBoard(board);
        room.setGameStartedAt(Instant.now());
        room.setStatus(AppleBattleRoom.Status.PLAYING);

        // 각 플레이어에게 개인 채널로 GAME_STARTED 발송 (보드 데이터 포함)
        for (PlayerInfo player : room.getPlayers()) {
            Map<String, Object> gameStartPayload = new LinkedHashMap<>();
            gameStartPayload.put("roomId", roomId);
            gameStartPayload.put("playerId", player.getPlayerId());
            gameStartPayload.put("board", boardToSerializable(board));
            gameStartPayload.put("rows", ROWS);
            gameStartPayload.put("cols", COLS);
            gameStartPayload.put("gameDurationSeconds", GAME_DURATION_SECONDS);
            gameStartPayload.put("serverStartAt", Instant.now().atZone(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ISO_INSTANT));

            messagingTemplate.convertAndSendToUser(
                    player.getPlayerId(), USER_QUEUE_BOARD,
                    buildEnvelope("GAME_STARTED", gameStartPayload));
        }

        // 120초 게임 종료 타이머
        ScheduledFuture<?> gameEndFuture = taskScheduler.schedule(() -> {
            AppleBattleRoom r = roomManager.getRoom(roomId).orElse(null);
            if (r == null) return;
            if (r.getStatus() != AppleBattleRoom.Status.PLAYING) return;

            log.info("게임 시간 종료: roomId={}", roomId);
            if (r.getFinished().compareAndSet(false, true)) {
                String winnerId = determineWinner(r);
                finishGame(r, winnerId, "TIME_UP");
            }
        }, Instant.now().plusSeconds(GAME_DURATION_SECONDS));

        room.setGameEndFuture(gameEndFuture);
        log.info("startGame: roomId={} — 보드 생성 완료, {}초 타이머 시작", roomId, GAME_DURATION_SECONDS);
    }

    // ─── 게임 종료 ────────────────────────────────────────────────────────────

    /**
     * 게임 종료 처리.
     */
    @Transactional
    public void finishGame(AppleBattleRoom room, String winnerId, String reason) {
        String roomId = room.getRoomId();
        room.setStatus(AppleBattleRoom.Status.FINISHED);

        // 모든 타이머 취소
        cancelGameTimers(room);
        room.getDisconnectFutures().forEach((pid, f) -> { if (!f.isDone()) f.cancel(false); });
        room.getDisconnectFutures().clear();

        String finishedAtStr = Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_INSTANT);

        log.info("finishGame: roomId={} winnerId={} reason={}", roomId, winnerId, reason);

        // 점수 스냅샷
        Map<String, Integer> finalScores = new HashMap<>(room.getScores());

        // 결과 목록 구성
        List<Map<String, Object>> results = buildResultEntries(room, winnerId, finalScores);

        // 전적 저장
        try {
            recordWinLoss(room, winnerId);
        } catch (Exception e) {
            log.error("finishGame: 전적 저장 실패 roomId={}", roomId, e);
        }

        // GAME_RESULT 브로드캐스트
        Map<String, Object> resultPayload = new LinkedHashMap<>();
        resultPayload.put("roomId", roomId);
        resultPayload.put("winnerId", winnerId);
        resultPayload.put("reason", reason);
        resultPayload.put("scores", finalScores);
        resultPayload.put("results", results);
        resultPayload.put("finishedAt", finishedAtStr);
        broadcast(roomId, "GAME_RESULT", resultPayload);

        // 방 정리 타이머
        ScheduledFuture<?> closeFuture = taskScheduler.schedule(
                () -> {
                    roomManager.closeRoom(roomId);
                    log.info("finishGame: 방 정리 완료 roomId={}", roomId);
                },
                Instant.now().plusSeconds(ROOM_CLOSE_DELAY_SECONDS));
        room.setCloseRoomFuture(closeFuture);
    }

    /** 점수가 높은 플레이어를 승자로 결정. 동점이면 첫 번째 플레이어. */
    private String determineWinner(AppleBattleRoom room) {
        if (room.getPlayers().isEmpty()) return "none";
        if (room.getPlayers().size() == 1) return room.getPlayers().get(0).getPlayerId();

        String p1 = room.getPlayers().get(0).getPlayerId();
        String p2 = room.getPlayers().get(1).getPlayerId();
        int s1 = room.getScores().getOrDefault(p1, 0);
        int s2 = room.getScores().getOrDefault(p2, 0);

        if (s2 > s1) return p2;
        return p1; // 동점이면 p1 (선입장자) 승리
    }

    private List<Map<String, Object>> buildResultEntries(
            AppleBattleRoom room, String winnerId, Map<String, Integer> finalScores) {
        return room.getPlayers().stream()
                .map(p -> {
                    boolean isWinner = p.getPlayerId().equals(winnerId);
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("playerId", p.getPlayerId());
                    entry.put("nickname", p.getNickname());
                    entry.put("isGuest", p.isGuest());
                    entry.put("outcome", isWinner ? "WIN" : "LOSE");
                    entry.put("score", finalScores.getOrDefault(p.getPlayerId(), 0));
                    return entry;
                })
                .collect(Collectors.toList());
    }

    // ─── 전적 저장 ────────────────────────────────────────────────────────────

    @Transactional
    public void recordWinLoss(AppleBattleRoom room, String winnerId) {
        for (PlayerInfo player : room.getPlayers()) {
            if (player.isGuest() || player.getUserId() == null) continue;
            if (player.isVoluntaryLeft()) continue;

            boolean isWinner = player.getPlayerId().equals(winnerId);
            upsertBattleRecord(player.getUserId(), isWinner);
        }
    }

    @Transactional
    protected void upsertBattleRecord(Long userId, boolean isWinner) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("upsertBattleRecord: userId={} not found", userId);
            return;
        }

        AppleBattleRecord record = appleBattleRecordRepository
                .findByUserId(userId)
                .orElseGet(() -> AppleBattleRecord.builder()
                        .user(user)
                        .lastPlayedAt(LocalDateTime.now())
                        .build());

        record.setTotalGames(record.getTotalGames() + 1);
        record.setLastPlayedAt(LocalDateTime.now());
        if (isWinner) {
            record.setWinCount(record.getWinCount() + 1);
        } else {
            record.setLoseCount(record.getLoseCount() + 1);
        }

        appleBattleRecordRepository.save(record);
        log.debug("upsertBattleRecord: userId={} isWinner={}", userId, isWinner);
    }

    // ─── 상태 스냅샷 ──────────────────────────────────────────────────────────

    private Map<String, Object> buildStateSnapshot(AppleBattleRoom room, String playerId) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("roomId", room.getRoomId());
        snapshot.put("roomStatus", room.getStatus().name());

        List<Map<String, Object>> playerList = room.getPlayers().stream()
                .map(p -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("playerId", p.getPlayerId());
                    entry.put("nickname", p.getNickname());
                    entry.put("isGuest", p.isGuest());
                    return entry;
                })
                .collect(Collectors.toList());
        snapshot.put("players", playerList);
        snapshot.put("scores", new HashMap<>(room.getScores()));

        // PLAYING 상태에서만 보드 포함
        if (room.getStatus() == AppleBattleRoom.Status.PLAYING && room.getBoard() != null) {
            snapshot.put("board", boardToSerializable(room.getBoard()));
            snapshot.put("rows", ROWS);
            snapshot.put("cols", COLS);

            if (room.getGameStartedAt() != null) {
                long elapsedMs = Instant.now().toEpochMilli() - room.getGameStartedAt().toEpochMilli();
                snapshot.put("elapsedMs", elapsedMs);
                snapshot.put("remainingMs", Math.max(0, GAME_DURATION_SECONDS * 1000L - elapsedMs));
            }
        }

        return snapshot;
    }

    // ─── 보드 생성 ────────────────────────────────────────────────────────────

    /** AppleSessionService 와 동일한 가중치로 10×17 보드 생성. */
    private Integer[][] generateBoard() {
        Integer[][] board = new Integer[ROWS][COLS];
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c < COLS; c++) {
                board[r][c] = randomApple();
            }
        }
        return board;
    }

    private int randomApple() {
        int r = ThreadLocalRandom.current().nextInt(WEIGHT_TOTAL);
        for (int i = 0; i < WEIGHTS.length; i++) {
            r -= WEIGHTS[i];
            if (r < 0) return i + 1;
        }
        return 9;
    }

    /**
     * Integer[][] → Integer[][] (null 유지, JSON 직렬화 가능).
     * 이미 Integer 타입이므로 그대로 반환.
     */
    private Integer[][] boardToSerializable(Integer[][] board) {
        return board;
    }

    // ─── 타이머 취소 헬퍼 ───────────────────────────────────────────────────

    private void cancelGameTimers(AppleBattleRoom room) {
        ScheduledFuture<?> countdown = room.getCountdownFuture();
        if (countdown != null && !countdown.isDone()) countdown.cancel(false);

        ScheduledFuture<?> gameEnd = room.getGameEndFuture();
        if (gameEnd != null && !gameEnd.isDone()) gameEnd.cancel(false);
    }

    // ─── 브로드캐스트 헬퍼 ───────────────────────────────────────────────────

    private void broadcast(String roomId, String type, Object payload) {
        messagingTemplate.convertAndSend(TOPIC_PREFIX + roomId, buildEnvelope(type, payload));
    }

    private void sendError(String playerId, String code, String message) {
        messagingTemplate.convertAndSendToUser(
                playerId, USER_QUEUE_ERRORS,
                buildEnvelope("ERROR", Map.of("code", code, "message", message)));
    }

    private WsAppleBattleMessage buildEnvelope(String type, Object payload) {
        return WsAppleBattleMessage.builder()
                .type(type)
                .timestamp(Instant.now().atZone(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_INSTANT))
                .payload(payload)
                .build();
    }

    // ─── 내부 유틸 ───────────────────────────────────────────────────────────

    private AppleBattleJoinResponse createNewRoom(
            String playerId, String guestToken, String nickname,
            boolean isGuest, PlayerInfo player) {

        String newRoomId = generateRoomId();
        roomManager.createRoom(newRoomId);
        roomManager.addPlayer(newRoomId, player);

        log.info("AppleBattleRoomService.createNewRoom: roomId={} playerId={}", newRoomId, playerId);

        return AppleBattleJoinResponse.builder()
                .roomId(newRoomId)
                .playerId(playerId)
                .isGuest(isGuest)
                .guestToken(isGuest ? guestToken : null)
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(2)
                .opponentNickname(null)
                .build();
    }

    private String generateRoomId() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(8);
        Random rnd = new Random();
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;
        private final String playerId;
        public AlreadyInRoomException(String roomId, String playerId) {
            super("Already in apple-battle room: " + roomId);
            this.roomId = roomId;
            this.playerId = playerId;
        }
        public String getRoomId() { return roomId; }
        public String getPlayerId() { return playerId; }
    }

    public static class RoomNotFoundException extends RuntimeException {
        public RoomNotFoundException() { super("ROOM_NOT_FOUND"); }
    }

    public static class RoomFullOrStartedException extends RuntimeException {
        public RoomFullOrStartedException() { super("ROOM_FULL_OR_STARTED"); }
    }
}
