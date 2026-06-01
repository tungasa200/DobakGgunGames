package com.dobakggun.service;

import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom;
import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom.PlayerInfo;
import com.dobakggun.domain.minesweeper.MinesweeperBoardGenerator;
import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.minesweeper.*;
import com.dobakggun.entity.minesweeper.MinesweeperBattleRecord;
import com.dobakggun.entity.minesweeper.MinesweeperRoom;
import com.dobakggun.entity.User;
import com.dobakggun.repository.MinesweeperBattleRecordRepository;
import com.dobakggun.repository.MinesweeperRoomRepository;
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

/**
 * 지뢰찾기 배틀 핵심 게임 로직 서비스.
 * BattleRoomService(Blockfall) 와 완전히 별개 — 수정/참조 없음.
 */
@Slf4j
@Service
public class MinesweeperBattleRoomService {

    // ─── 상수 ─────────────────────────────────────────────────────────────────

    private static final int ROWS = 9;
    private static final int COLS = 9;
    private static final int MINES = 10;
    private static final int TOTAL_SAFE_CELLS = 71; // 81 - 10
    private static final int SAFE_R = 4;
    private static final int SAFE_C = 4;
    private static final int FIRST_CLICK_TIMEOUT_MS = 30_000;
    private static final int RECONNECT_GRACE_SECONDS = 15;
    private static final int ROOM_CLOSE_DELAY_SECONDS = 10;
    private static final String TOPIC_PREFIX = "/topic/minesweeper-battle/room/";
    private static final String USER_QUEUE_STATE = "/queue/minesweeper-battle/state";
    private static final String USER_QUEUE_BOARD = "/queue/minesweeper-battle/board";
    private static final String USER_QUEUE_ERRORS = "/queue/minesweeper-battle/errors";

    // ─── 의존성 ───────────────────────────────────────────────────────────────

    private final MinesweeperBattleRoomManager roomManager;
    private final MinesweeperRoomRepository minesweeperRoomRepository;
    private final MinesweeperBattleRecordRepository minesweeperBattleRecordRepository;
    private final UserRepository userRepository;
    private final ThreadPoolTaskScheduler taskScheduler;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public MinesweeperBattleRoomService(
            MinesweeperBattleRoomManager roomManager,
            MinesweeperRoomRepository minesweeperRoomRepository,
            MinesweeperBattleRecordRepository minesweeperBattleRecordRepository,
            UserRepository userRepository,
            @Qualifier("battleTaskScheduler") ThreadPoolTaskScheduler taskScheduler) {
        this.roomManager = roomManager;
        this.minesweeperRoomRepository = minesweeperRoomRepository;
        this.minesweeperBattleRecordRepository = minesweeperBattleRecordRepository;
        this.userRepository = userRepository;
        this.taskScheduler = taskScheduler;
    }

    // ─── 매칭 ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/minesweeper-battle/join 에서 호출.
     * WAITING 방(1명) 탐색 → 없으면 신규 방 생성.
     * 2번째 플레이어 입장 시 MATCH_READY 즉시 발송.
     */
    @Transactional
    public MinesweeperBattleJoinResponse joinOrCreate(
            Long userId, String guestToken, String nickname) {

        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        // 중복 참가 방지
        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                MinesweeperBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                // FINISHED 방이면 제거 후 재진입 허용
                if (existing != null && existing.getStatus() == MinesweeperBattleRoom.Status.FINISHED) {
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get());
                }
            }
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);

        // 1. WAITING 방(1명) 탐색
        Optional<MinesweeperBattleRoom> waitingRoom = roomManager.findWaitingRoom();

        if (waitingRoom.isPresent()) {
            MinesweeperBattleRoom room = waitingRoom.get();
            ReentrantLock lock = roomManager.getRoomLock(room.getRoomId());
            lock.lock();
            try {
                // 재확인: lock 획득 사이에 다른 스레드가 이미 채웠을 수 있음
                if (room.getPlayerCount() >= 2 || room.getStatus() != MinesweeperBattleRoom.Status.WAITING) {
                    // 이 방은 이미 찼음 → 신규 방 생성 (lock 해제 후)
                    lock.unlock();
                    return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
                }

                boolean joined = roomManager.addPlayer(room.getRoomId(), newPlayer);
                if (!joined) {
                    lock.unlock();
                    return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
                }

                // 2명 완성 → MATCH_READY 상태 전이
                room.setStatus(MinesweeperBattleRoom.Status.MATCH_READY);

                // DB 상태 업데이트
                updateBattleRoomDB(room.getRoomId(), "MATCH_READY", 2);

                // FIRST_CLICK 30초 타임아웃 스케줄
                scheduleFirstClickTimeout(room);

                // MATCH_READY 발송 (lock 해제 후 발송 — 메시지 순서 보장 필요 없음)
                lock.unlock();

                sendMatchReady(room);

                PlayerInfo firstPlayer = room.getPlayers().get(0);
                return MinesweeperBattleJoinResponse.builder()
                        .roomId(room.getRoomId())
                        .playerId(playerId)
                        .isGuest(isGuest)
                        .guestToken(isGuest ? guestToken : null)
                        .status("MATCH_READY")
                        .playerCount(2)
                        .maxPlayers(2)
                        .designatedCell(Map.of("r", SAFE_R, "c", SAFE_C))
                        .opponentNickname(firstPlayer.getNickname())
                        .build();

            } catch (Exception e) {
                if (lock.isHeldByCurrentThread()) lock.unlock();
                throw e;
            }
        }

        // 2. WAITING 방 없음 → 신규 방 생성
        return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
    }

    @Transactional
    protected MinesweeperBattleJoinResponse createNewRoom(
            String playerId, String guestToken, String nickname,
            boolean isGuest, PlayerInfo player) {

        String newRoomId = generateRoomId();

        // 인메모리 방 생성
        roomManager.createRoom(newRoomId);
        roomManager.addPlayer(newRoomId, player);

        // DB 방 생성
        MinesweeperRoom dbRoom = MinesweeperRoom.builder()
                .roomId(newRoomId)
                .status("WAITING")
                .maxPlayers(2)
                .currentPlayers(1)
                .queueCount(0)
                .build();
        minesweeperRoomRepository.save(dbRoom);

        log.info("MinesweeperBattleRoomService.createNewRoom: roomId={} playerId={}", newRoomId, playerId);

        return MinesweeperBattleJoinResponse.builder()
                .roomId(newRoomId)
                .playerId(playerId)
                .isGuest(isGuest)
                .guestToken(isGuest ? guestToken : null)
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(2)
                .designatedCell(Map.of("r", SAFE_R, "c", SAFE_C))
                .opponentNickname(null)
                .build();
    }

    // ─── WebSocket 핸들러 ──────────────────────────────────────────────────────

    /**
     * FIRST_CLICK 수신 처리.
     * 양쪽 수신 완료 시 adjMines 생성 + GAME_STARTED 발송.
     */
    public void handleFirstClick(String roomId, String playerId, int r, int c) {
        MinesweeperBattleRoom room = getRoomOrError(roomId, playerId);
        if (room == null) return;

        // 이미 PLAYING / FINISHED 상태면 무시
        if (room.getStatus() == MinesweeperBattleRoom.Status.PLAYING
                || room.getStatus() == MinesweeperBattleRoom.Status.FINISHED) {
            sendError(playerId, "ALREADY_FINISHED", "게임이 이미 시작 또는 종료됐습니다.");
            return;
        }

        // 지정 셀 검증
        if (r != SAFE_R || c != SAFE_C) {
            sendError(playerId, "INVALID_FIRST_CLICK",
                    "지정된 시작 셀(" + SAFE_R + "," + SAFE_C + ")을 클릭해야 합니다.");
            return;
        }

        room.getFirstClickSet().add(playerId);
        log.debug("handleFirstClick: roomId={} playerId={} firstClickSet={}", roomId, playerId, room.getFirstClickSet().size());

        // 상대방에게 클릭 완료 알림 (opponentFirstClickConfirmed 실시간 반영)
        PlayerInfo opponent = room.findOpponent(playerId);
        if (opponent != null && opponent.getPlayerId() != null) {
            messagingTemplate.convertAndSendToUser(
                    opponent.getPlayerId(), USER_QUEUE_STATE,
                    buildEnvelope("FIRST_CLICK_CONFIRMED", Map.of("playerId", playerId)));
        }

        // 양쪽 FIRST_CLICK 수신 확인
        if (room.getFirstClickSet().size() >= 2) {
            // FIRST_CLICK 타임아웃 취소
            cancelFirstClickTimeout(room);

            // 보드 생성 및 게임 시작
            startGame(room);
        }
    }

    /**
     * 진행률 수신 → 상대에게 PROGRESS_UPDATE 전파.
     */
    public void handleProgress(String roomId, String playerId, int revealedCount) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null || room.getStatus() != MinesweeperBattleRoom.Status.PLAYING) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        // 진행률 업데이트
        player.updateProgress(revealedCount, TOTAL_SAFE_CELLS);

        int progressPercent = (int) Math.floor((double) revealedCount / TOTAL_SAFE_CELLS * 100);

        ProgressUpdatePayload payload = ProgressUpdatePayload.builder()
                .playerId(playerId)
                .revealedCount(revealedCount)
                .totalSafeCells(TOTAL_SAFE_CELLS)
                .progressPercent(progressPercent)
                .build();

        // 방 전체 브로드캐스트 (클라이언트가 자기 자신 메시지는 무시)
        broadcast(roomId, "PROGRESS_UPDATE", payload);
    }

    /**
     * BOARD_CLEAR 수신 → 승패 판정.
     * 서버 도달 시점 기준으로 먼저 도달한 BOARD_CLEAR 우선.
     */
    public void handleBoardClear(String roomId, String playerId, long elapsedMs) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        if (room.getStatus() != MinesweeperBattleRoom.Status.PLAYING) {
            sendError(playerId, "ALREADY_FINISHED", "게임이 이미 종료됐습니다.");
            return;
        }

        // elapsedMs 기본 검증 (음수는 거부)
        if (elapsedMs < 0) {
            sendError(playerId, "INVALID_ELAPSED", "elapsedMs 값이 유효하지 않습니다.");
            return;
        }

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        // 서버 도달 시점 기록
        long arrivedAt = System.currentTimeMillis();
        player.setFinishedAtMillis(arrivedAt);
        player.setReportedElapsedMs(elapsedMs);
        player.setEndReason("CLEAR");

        log.info("handleBoardClear: roomId={} playerId={} elapsedMs={} arrivedAt={}", roomId, playerId, elapsedMs, arrivedAt);

        // finishGame — AtomicBoolean 으로 중복 처리 방지
        if (room.getFinished().compareAndSet(false, true)) {
            finishGame(room, playerId, "BOARD_CLEAR");
        }
        // 이미 다른 쪽이 처리 중이면 무시 (타이브레이커는 arrivedAt 비교로 처리)
    }

    /**
     * MINE_HIT 수신 → 즉시 패배 처리.
     */
    public void handleMineHit(String roomId, String playerId, long elapsedMs, int r, int c) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        if (room.getStatus() != MinesweeperBattleRoom.Status.PLAYING) {
            sendError(playerId, "ALREADY_FINISHED", "게임이 이미 종료됐습니다.");
            return;
        }

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        player.setFinishedAtMillis(System.currentTimeMillis());
        player.setReportedElapsedMs(elapsedMs);
        player.setEndReason("MINE");

        log.info("handleMineHit: roomId={} playerId={} r={} c={}", roomId, playerId, r, c);

        if (room.getFinished().compareAndSet(false, true)) {
            // MINE_HIT 는 본인 패배 → 상대 승리
            PlayerInfo opponent = room.findOpponent(playerId);
            String winnerId = (opponent != null) ? opponent.getPlayerId() : playerId;
            finishGame(room, winnerId, "MINE_HIT");
        }
    }

    /**
     * LEAVE 수신 — 자발적 이탈.
     * 전적 미가산. 상대 부전승.
     */
    public void handleLeave(String roomId, String playerId) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player != null) {
            player.setVoluntaryLeft(true);
            player.setEndReason("LEAVE");
        }

        log.info("handleLeave: roomId={} playerId={}", roomId, playerId);

        if (room.getStatus() == MinesweeperBattleRoom.Status.PLAYING
                || room.getStatus() == MinesweeperBattleRoom.Status.MATCH_READY) {
            if (room.getFinished().compareAndSet(false, true)) {
                PlayerInfo opponent = room.findOpponent(playerId);
                String winnerId = (opponent != null) ? opponent.getPlayerId() : playerId;
                finishGame(room, winnerId, "OPPONENT_LEAVE");
            }
        } else if (room.getStatus() == MinesweeperBattleRoom.Status.WAITING) {
            // 대기 중 이탈 — 방 정리
            room.setStatus(MinesweeperBattleRoom.Status.FINISHED);
            roomManager.closeRoom(roomId);
            updateBattleRoomDB(roomId, "FINISHED", 0);
        }
    }

    /**
     * REQUEST_STATE 수신 — 재연결 후 상태 복원.
     */
    public void handleRequestState(String roomId, String playerId) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) {
            sendError(playerId, "STATE_RESTORE_FAILED", "방을 찾을 수 없습니다.");
            return;
        }

        StateSnapshotPayload snapshot = buildStateSnapshot(room, playerId);
        messagingTemplate.convertAndSendToUser(
                playerId, USER_QUEUE_STATE, buildEnvelope("STATE_SNAPSHOT", snapshot));

        log.debug("handleRequestState: roomId={} playerId={}", roomId, playerId);
    }

    /**
     * SessionDisconnectEvent 에서 호출.
     * 15초 grace period — 재연결 안 하면 finishGame.
     */
    public void handleDisconnect(String sessionId) {
        String roomId = roomManager.findRoomIdBySession(sessionId).orElse(null);
        if (roomId == null) return;

        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayerBySession(sessionId);
        if (player == null) return;

        String playerId = player.getPlayerId();
        roomManager.unregisterSession(sessionId);

        // FINISHED 방은 무시
        if (room.getStatus() == MinesweeperBattleRoom.Status.FINISHED) return;

        log.info("handleDisconnect: roomId={} playerId={} — grace period 시작", roomId, playerId);

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

        // 15초 후 grace period 만료 → 상대 승리
        final String capturedPlayerId = playerId;
        ScheduledFuture<?> graceFuture = taskScheduler.schedule(() -> {
            MinesweeperBattleRoom r = getRoom(roomId).orElse(null);
            if (r == null) return;

            // 재연결 됐으면 disconnected 플래그가 false
            PlayerInfo p = r.findPlayer(capturedPlayerId);
            if (p == null || !p.isDisconnected()) {
                log.debug("grace period 만료 but 재연결 됨: roomId={} playerId={}", roomId, capturedPlayerId);
                return;
            }

            log.info("grace period 만료 → 상대 승리: roomId={} playerId={}", roomId, capturedPlayerId);
            p.setEndReason("DISCONNECT");

            if (r.getFinished().compareAndSet(false, true)) {
                PlayerInfo opp = r.findOpponent(capturedPlayerId);
                String winnerId = (opp != null) ? opp.getPlayerId() : capturedPlayerId;
                finishGame(r, winnerId, "OPPONENT_DISCONNECT");
            }
        }, Instant.now().plusSeconds(RECONNECT_GRACE_SECONDS));

        room.getDisconnectFutures().put(playerId, graceFuture);
    }

    /**
     * 재연결 시 호출 — grace period 취소, 상대에게 OPPONENT_RECONNECTED 전송.
     */
    public void handleReconnect(String roomId, String playerId, String newSessionId) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        // grace period 취소
        ScheduledFuture<?> graceFuture = room.getDisconnectFutures().remove(playerId);
        if (graceFuture != null && !graceFuture.isDone()) {
            graceFuture.cancel(false);
        }

        // 세션 재등록
        roomManager.registerSession(roomId, playerId, newSessionId);

        // 상대에게 OPPONENT_RECONNECTED 전송
        PlayerInfo opponent = room.findOpponent(playerId);
        if (opponent != null && opponent.getPlayerId() != null) {
            messagingTemplate.convertAndSendToUser(
                    opponent.getPlayerId(), USER_QUEUE_STATE,
                    buildEnvelope("OPPONENT_RECONNECTED", Map.of("opponentId", playerId)));
        }

        log.info("handleReconnect: roomId={} playerId={} newSessionId={}", roomId, playerId, newSessionId);
    }

    // ─── 게임 시작 ────────────────────────────────────────────────────────────

    /**
     * 양쪽 FIRST_CLICK 수신 완료 후 게임 시작.
     * 보드 생성 → GAME_STARTED 양쪽 개인 큐로 동시 발송.
     */
    private void startGame(MinesweeperBattleRoom room) {
        String roomId = room.getRoomId();

        // 시드 생성
        long seed = ThreadLocalRandom.current().nextLong() ^ System.nanoTime();
        int[][] adjMines = MinesweeperBoardGenerator.generate(seed, ROWS, COLS, MINES, SAFE_R, SAFE_C);

        room.setAdjMines(adjMines);
        room.setSeed(seed);
        long now = System.currentTimeMillis();
        room.setServerStartAtMillis(now);
        room.setStatus(MinesweeperBattleRoom.Status.PLAYING);

        // DB 업데이트
        updateBattleRoomDB(roomId, "PLAYING", 2);
        updateBattleRoomStartedAt(roomId, LocalDateTime.now());

        String serverStartAt = Instant.ofEpochMilli(now).atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_INSTANT);

        // 각 플레이어에게 개인 큐로 GAME_STARTED 발송 (adjMines 동일)
        for (PlayerInfo player : room.getPlayers()) {
            GameStartedPayload payload = GameStartedPayload.builder()
                    .roomId(roomId)
                    .playerId(player.getPlayerId())
                    .adjMines(adjMines)
                    .serverStartAt(serverStartAt)
                    .serverStartAtMillis(now)
                    .build();
            messagingTemplate.convertAndSendToUser(
                    player.getPlayerId(), USER_QUEUE_BOARD,
                    buildEnvelope("GAME_STARTED", payload));
        }

        log.info("startGame: roomId={} seed={} serverStartAt={}", roomId, seed, serverStartAt);
    }

    // ─── 게임 종료 ────────────────────────────────────────────────────────────

    /**
     * 게임 종료 처리.
     * - AtomicBoolean 으로 호출자가 이미 compareAndSet 완료 후 호출.
     * - DB: battle_room 상태 FINISHED, battle_record UPSERT.
     * - GAME_RESULT 브로드캐스트.
     * - 10초 후 방 정리.
     */
    @Transactional
    public void finishGame(MinesweeperBattleRoom room, String winnerId, String reason) {
        String roomId = room.getRoomId();
        room.setStatus(MinesweeperBattleRoom.Status.FINISHED);

        String finishedAtStr = Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_INSTANT);

        log.info("finishGame: roomId={} winnerId={} reason={}", roomId, winnerId, reason);

        // 플레이어 결과 목록 구성
        List<GameResultPayload.ResultEntry> results = buildResultEntries(room, winnerId, reason);

        // winner/loser endReason 보완 (승자에게 OPPONENT_FORFEIT 등)
        assignWinnerEndReason(room, winnerId, reason);

        // DB 업데이트 (비동기 실패해도 게임 진행은 무관)
        try {
            updateBattleRoomFinished(roomId);
        } catch (Exception e) {
            log.error("finishGame: DB battle_room 업데이트 실패 roomId={}", roomId, e);
        }

        // 전적 UPSERT (로그인 유저 + 자발적 이탈이 아닌 경우만)
        try {
            recordWinLoss(room, winnerId, reason);
        } catch (Exception e) {
            log.error("finishGame: 전적 저장 실패 roomId={}", roomId, e);
        }

        // GAME_RESULT 브로드캐스트
        GameResultPayload resultPayload = GameResultPayload.builder()
                .roomId(roomId)
                .winnerId(winnerId)
                .reason(reason)
                .results(results)
                .finishedAt(finishedAtStr)
                .build();
        broadcast(roomId, "GAME_RESULT", resultPayload);

        // 10초 후 방 정리
        ScheduledFuture<?> closeFuture = taskScheduler.schedule(
                () -> {
                    roomManager.closeRoom(roomId);
                    log.info("finishGame: 방 정리 완료 roomId={}", roomId);
                },
                Instant.now().plusSeconds(ROOM_CLOSE_DELAY_SECONDS));
        room.setCloseRoomFuture(closeFuture);
    }

    private List<GameResultPayload.ResultEntry> buildResultEntries(
            MinesweeperBattleRoom room, String winnerId, String reason) {
        return room.getPlayers().stream()
                .map(p -> {
                    boolean isWinner = p.getPlayerId().equals(winnerId);

                    // 게임을 실제로 끝낸 플레이어만 시간 표시
                    // MINE_HIT  → 지뢰 밟은 패자 시간만 의미 있음
                    // BOARD_CLEAR → 클리어한 승자 시간만 의미 있음
                    // 그 외(LEAVE, DISCONNECT 등) → 양쪽 모두 시간 없음
                    boolean showElapsed = switch (reason) {
                        case "MINE_HIT"    -> !isWinner;
                        case "BOARD_CLEAR" -> isWinner;
                        default            -> false;
                    };

                    long elapsedMs = 0;
                    if (showElapsed) {
                        elapsedMs = p.getReportedElapsedMs();
                        if (elapsedMs < 0) {
                            elapsedMs = (room.getServerStartAtMillis() > 0)
                                    ? System.currentTimeMillis() - room.getServerStartAtMillis()
                                    : 0;
                        }
                    }

                    double elapsedSeconds = elapsedMs > 0 ? Math.round(elapsedMs / 10.0) / 100.0 : 0.0;
                    return GameResultPayload.ResultEntry.builder()
                            .playerId(p.getPlayerId())
                            .nickname(p.getNickname())
                            .isGuest(p.isGuest())
                            .outcome(isWinner ? "WIN" : "LOSE")
                            .elapsedMs(elapsedMs)
                            .elapsedSeconds(elapsedSeconds)
                            .endReason(p.getEndReason() != null ? p.getEndReason() : (isWinner ? "OPPONENT_FORFEIT" : "UNKNOWN"))
                            .build();
                })
                .toList();
    }

    private void assignWinnerEndReason(MinesweeperBattleRoom room, String winnerId, String reason) {
        // 승자의 endReason 이 없으면 reason 기반으로 채워줌
        PlayerInfo winner = room.findPlayer(winnerId);
        if (winner != null && winner.getEndReason() == null) {
            switch (reason) {
                case "MINE_HIT" -> winner.setEndReason("OPPONENT_FORFEIT");
                case "OPPONENT_DISCONNECT" -> winner.setEndReason("OPPONENT_FORFEIT");
                case "OPPONENT_LEAVE" -> winner.setEndReason("OPPONENT_FORFEIT");
                case "FIRST_CLICK_TIMEOUT" -> winner.setEndReason("OPPONENT_FORFEIT");
                default -> winner.setEndReason("CLEAR");
            }
        }
    }

    // ─── 전적 저장 ────────────────────────────────────────────────────────────

    /**
     * battle_record UPSERT.
     * 자발적 이탈(LEAVE, FIRST_CLICK_TIMEOUT 미클릭) 플레이어는 제외.
     * reason=OPPONENT_LEAVE 는 상대가 이탈한 것이므로 승자(살아있는 쪽)는 기록.
     */
    @Transactional
    public void recordWinLoss(MinesweeperBattleRoom room, String winnerId, String reason) {
        for (PlayerInfo player : room.getPlayers()) {
            if (player.isGuest() || player.getUserId() == null) continue;
            if (player.isVoluntaryLeft()) continue; // 자발적 이탈 — 미가산

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

        MinesweeperBattleRecord record = minesweeperBattleRecordRepository
                .findByUserId(userId)
                .orElseGet(() -> MinesweeperBattleRecord.builder()
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

        minesweeperBattleRecordRepository.save(record);
        log.debug("upsertBattleRecord: userId={} isWinner={}", userId, isWinner);
    }

    // ─── FIRST_CLICK 타임아웃 ─────────────────────────────────────────────────

    private void scheduleFirstClickTimeout(MinesweeperBattleRoom room) {
        String roomId = room.getRoomId();
        ScheduledFuture<?> future = taskScheduler.schedule(() -> {
            MinesweeperBattleRoom r = getRoom(roomId).orElse(null);
            if (r == null || r.getStatus() != MinesweeperBattleRoom.Status.MATCH_READY) return;

            Set<String> clicked = r.getFirstClickSet();
            List<PlayerInfo> players = r.getPlayers();

            if (clicked.size() >= 2) return; // 이미 양쪽 클릭 완료

            log.info("FIRST_CLICK 타임아웃: roomId={} clicked={}", roomId, clicked.size());

            if (clicked.isEmpty()) {
                // 양쪽 미클릭 — 양쪽 패배 처리 (전적 미가산)
                players.forEach(p -> p.setVoluntaryLeft(true));
                if (r.getFinished().compareAndSet(false, true)) {
                    // 승자 없음 — winnerId 에 임의 지정 후 reason 으로 구분
                    String winnerId = players.isEmpty() ? "none" : players.get(0).getPlayerId();
                    finishGame(r, winnerId, "FIRST_CLICK_TIMEOUT");
                }
            } else {
                // 한 쪽만 클릭 — 클릭한 쪽 부전승, 미클릭 쪽 패배(전적 미가산)
                String clickedId = clicked.iterator().next();
                Optional<PlayerInfo> notClicked = players.stream()
                        .filter(p -> !p.getPlayerId().equals(clickedId))
                        .findFirst();
                notClicked.ifPresent(p -> p.setVoluntaryLeft(true));

                if (r.getFinished().compareAndSet(false, true)) {
                    finishGame(r, clickedId, "FIRST_CLICK_TIMEOUT");
                }
            }
        }, Instant.now().plusMillis(FIRST_CLICK_TIMEOUT_MS));

        room.setFirstClickTimeoutFuture(future);
    }

    private void cancelFirstClickTimeout(MinesweeperBattleRoom room) {
        ScheduledFuture<?> future = room.getFirstClickTimeoutFuture();
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
    }

    // ─── 상태 스냅샷 ──────────────────────────────────────────────────────────

    public StateSnapshotPayload buildStateSnapshot(MinesweeperBattleRoom room, String playerId) {
        List<StateSnapshotPayload.PlayerEntry> playerEntries = room.getPlayers().stream()
                .map(p -> StateSnapshotPayload.PlayerEntry.builder()
                        .playerId(p.getPlayerId())
                        .nickname(p.getNickname())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        PlayerInfo me = room.findPlayer(playerId);
        PlayerInfo opponent = room.findOpponent(playerId);

        boolean myFirstClick = room.getFirstClickSet().contains(playerId);
        boolean opponentFirstClick = (opponent != null) && room.getFirstClickSet().contains(opponent.getPlayerId());

        StateSnapshotPayload.ProgressEntry myProgress = StateSnapshotPayload.ProgressEntry.builder()
                .revealedCount(me != null ? me.getRevealedCount() : 0)
                .progressPercent(me != null ? me.getProgressPercent() : 0)
                .build();

        StateSnapshotPayload.ProgressEntry opponentProgress = StateSnapshotPayload.ProgressEntry.builder()
                .revealedCount(opponent != null ? opponent.getRevealedCount() : 0)
                .progressPercent(opponent != null ? opponent.getProgressPercent() : 0)
                .build();

        // PLAYING 상태에서만 adjMines 포함
        int[][] adjMines = (room.getStatus() == MinesweeperBattleRoom.Status.PLAYING)
                ? room.getAdjMines() : null;

        return StateSnapshotPayload.builder()
                .roomId(room.getRoomId())
                .roomStatus(room.getStatus().name())
                .players(playerEntries)
                .adjMines(adjMines)
                .serverStartAtMillis(room.getServerStartAtMillis())
                .myFirstClickConfirmed(myFirstClick)
                .opponentFirstClickConfirmed(opponentFirstClick)
                .myProgress(myProgress)
                .opponentProgress(opponentProgress)
                .build();
    }

    // ─── 세션 연결 이벤트 ────────────────────────────────────────────────────

    /**
     * SessionConnectedEvent 에서 호출.
     * 방에 플레이어가 이미 배정된 경우 sessionId 등록.
     * 재연결이면 handleReconnect 로 이어짐.
     */
    public void handleConnect(String playerId, String sessionId) {
        Optional<String> roomIdOpt = roomManager.findRoomIdByPlayer(playerId);
        if (roomIdOpt.isEmpty()) return;

        String roomId = roomIdOpt.get();
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) return;

        PlayerInfo player = room.findPlayer(playerId);
        if (player == null) return;

        boolean wasDisconnected = player.isDisconnected();
        roomManager.registerSession(roomId, playerId, sessionId);

        if (wasDisconnected) {
            handleReconnect(roomId, playerId, sessionId);
        }

        log.debug("handleConnect: roomId={} playerId={} sessionId={} wasDisconnected={}", roomId, playerId, sessionId, wasDisconnected);
    }

    // ─── DB 헬퍼 ──────────────────────────────────────────────────────────────

    @Transactional
    protected void updateBattleRoomDB(String roomId, String status, int currentPlayers) {
        minesweeperRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(status);
            room.setCurrentPlayers(currentPlayers);
            minesweeperRoomRepository.save(room);
        });
    }

    @Transactional
    protected void updateBattleRoomStartedAt(String roomId, LocalDateTime startedAt) {
        minesweeperRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStartedAt(startedAt);
            minesweeperRoomRepository.save(room);
        });
    }

    @Transactional
    protected void updateBattleRoomFinished(String roomId) {
        minesweeperRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus("FINISHED");
            room.setFinishedAt(LocalDateTime.now());
            room.setClosedAt(LocalDateTime.now().plusSeconds(ROOM_CLOSE_DELAY_SECONDS));
            minesweeperRoomRepository.save(room);
        });
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

    private WsBattleMessage buildEnvelope(String type, Object payload) {
        return WsBattleMessage.builder()
                .type(type)
                .timestamp(Instant.now().atZone(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_INSTANT))
                .payload(payload)
                .build();
    }

    /**
     * MATCH_READY 를 각 플레이어에게 개별 발송.
     * opponentNickname 이 수신자 관점으로 다르게 설정됨.
     */
    private void sendMatchReady(MinesweeperBattleRoom room) {
        if (room.getPlayers().size() < 2) return;

        List<MatchReadyPayload.PlayerEntry> playerEntries = room.getPlayers().stream()
                .map(p -> MatchReadyPayload.PlayerEntry.builder()
                        .playerId(p.getPlayerId())
                        .nickname(p.getNickname())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        for (PlayerInfo player : room.getPlayers()) {
            PlayerInfo opp = room.findOpponent(player.getPlayerId());
            MatchReadyPayload payload = MatchReadyPayload.builder()
                    .roomId(room.getRoomId())
                    .designatedCell(Map.of("r", SAFE_R, "c", SAFE_C))
                    .players(playerEntries)
                    .opponentNickname(opp != null ? opp.getNickname() : null)
                    .firstClickTimeoutMs(FIRST_CLICK_TIMEOUT_MS)
                    .build();
            messagingTemplate.convertAndSendToUser(
                    player.getPlayerId(), USER_QUEUE_STATE,
                    buildEnvelope("MATCH_READY", payload));
        }
        log.debug("sendMatchReady: roomId={}", room.getRoomId());
    }

    // ─── 유틸 ────────────────────────────────────────────────────────────────

    private Optional<MinesweeperBattleRoom> getRoom(String roomId) {
        return roomManager.getRoom(roomId);
    }

    /**
     * 방 조회 + 플레이어 참가 여부 검증.
     * 유효하지 않으면 에러 전송 후 null 반환.
     */
    private MinesweeperBattleRoom getRoomOrError(String roomId, String playerId) {
        MinesweeperBattleRoom room = getRoom(roomId).orElse(null);
        if (room == null) {
            sendError(playerId, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
            return null;
        }
        if (room.findPlayer(playerId) == null) {
            sendError(playerId, "NOT_IN_ROOM", "해당 방에 참가하지 않았습니다.");
            return null;
        }
        return room;
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

    // ─── 방 목록 조회 ────────────────────────────────────────────────────────

    /**
     * GET /api/minesweeper-battle/rooms/waiting
     * 인메모리에서 WAITING + 1명인 방 목록 반환 (최대 20개).
     */
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
                            .build();
                })
                .collect(java.util.stream.Collectors.toList());
    }

    // ─── 방 직접 생성 ────────────────────────────────────────────────────────

    /**
     * POST /api/minesweeper-battle/create — 신규 방 생성만 (자동 합류 없음).
     */
    @Transactional
    public MinesweeperBattleJoinResponse createRoomOnly(
            Long userId, String guestToken, String nickname) {

        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        // 중복 참가 방지
        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                MinesweeperBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                if (existing != null && existing.getStatus() == MinesweeperBattleRoom.Status.FINISHED) {
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get());
                }
            }
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);
        return createNewRoom(playerId, guestToken, nickname, isGuest, newPlayer);
    }

    // ─── 방 직접 입장 ────────────────────────────────────────────────────────

    /**
     * POST /api/minesweeper-battle/join/{roomId} — 특정 방에 직접 입장.
     */
    @Transactional
    public MinesweeperBattleJoinResponse joinSpecificRoom(
            String roomId, Long userId, String guestToken, String nickname) {

        String playerId = (userId != null) ? String.valueOf(userId) : guestToken;
        boolean isGuest = (userId == null);

        // 중복 참가 방지
        if (roomManager.isPlayerInAnyRoom(playerId)) {
            Optional<String> existingRoomId = roomManager.findRoomIdByPlayer(playerId);
            if (existingRoomId.isPresent()) {
                MinesweeperBattleRoom existing = roomManager.getRoom(existingRoomId.get()).orElse(null);
                if (existing != null && existing.getStatus() == MinesweeperBattleRoom.Status.FINISHED) {
                    roomManager.removePlayer(existingRoomId.get(), playerId);
                } else {
                    throw new AlreadyInRoomException(existingRoomId.get());
                }
            }
        }

        // 방 조회
        MinesweeperBattleRoom room = roomManager.getRoom(roomId)
                .orElseThrow(RoomNotFoundException::new);

        // 방 상태 확인
        if (room.getStatus() != MinesweeperBattleRoom.Status.WAITING
                || room.getPlayerCount() >= 2) {
            throw new RoomFullOrStartedException();
        }

        PlayerInfo newPlayer = new PlayerInfo(playerId, nickname, isGuest, userId);

        ReentrantLock lock = roomManager.getRoomLock(roomId);
        lock.lock();
        try {
            // lock 획득 후 재확인
            if (room.getPlayerCount() >= 2 || room.getStatus() != MinesweeperBattleRoom.Status.WAITING) {
                throw new RoomFullOrStartedException();
            }

            boolean joined = roomManager.addPlayer(roomId, newPlayer);
            if (!joined) {
                throw new RoomFullOrStartedException();
            }

            room.setStatus(MinesweeperBattleRoom.Status.MATCH_READY);
            updateBattleRoomDB(roomId, "MATCH_READY", 2);
            scheduleFirstClickTimeout(room);
            lock.unlock();

            sendMatchReady(room);

            PlayerInfo firstPlayer = room.getPlayers().get(0);
            return MinesweeperBattleJoinResponse.builder()
                    .roomId(roomId)
                    .playerId(playerId)
                    .isGuest(isGuest)
                    .guestToken(isGuest ? guestToken : null)
                    .status("MATCH_READY")
                    .playerCount(2)
                    .maxPlayers(2)
                    .designatedCell(Map.of("r", SAFE_R, "c", SAFE_C))
                    .opponentNickname(firstPlayer.getNickname())
                    .build();

        } catch (Exception e) {
            if (lock.isHeldByCurrentThread()) lock.unlock();
            throw e;
        }
    }

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;
        public AlreadyInRoomException(String roomId) {
            super("Already in minesweeper room: " + roomId);
            this.roomId = roomId;
        }
        public String getRoomId() { return roomId; }
    }

    public static class RoomNotFoundException extends RuntimeException {
        public RoomNotFoundException() {
            super("ROOM_NOT_FOUND");
        }
    }

    public static class RoomFullOrStartedException extends RuntimeException {
        public RoomFullOrStartedException() {
            super("ROOM_FULL_OR_STARTED");
        }
    }
}
