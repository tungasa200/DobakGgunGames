package com.dobakggun.service;

import com.dobakggun.dto.WaitingRoomInfo;
import com.dobakggun.dto.battle.*;
import com.dobakggun.entity.battle.BattleRoom;
import com.dobakggun.exception.GameDisabledException;
import com.dobakggun.repository.BattleRoomRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * 블록폴 배틀 방 핵심 서비스.
 * - 매칭/큐/상태 전이 관리
 * - 게임 이벤트(보드 전파, 공격, 이탈, 종료) 처리
 * - DB: BattleRoom (방 메타), BattleRecord (전적) — 각각 트랜잭션 분리
 */
@Slf4j
@Service
public class BattleRoomService {

    private static final int COUNTDOWN_SECONDS = 5;
    /** 큐에 사람이 있을 때 결과 화면 뒤 자동 승격까지의 시간 (PRD §5.3, [pm 결정] 블록폴 큐 승격 시점) */
    static final int AUTO_NEXT_ROUND_SECONDS = 10;
    private static final int RECONNECT_GRACE_SECONDS = 15;
    private static final String TOPIC_PREFIX = "/topic/blockfall-battle/room/";
    private static final int MAX_PLAYERS = 5;

    // ─── 카운트다운 Future / 종료 시각 저장 ─────────────────────────────────────
    private final ConcurrentHashMap<String, ScheduledFuture<?>> countdownFutures = new ConcurrentHashMap<>();
    /** 카운트다운 종료 예정 시각 (남은 초 계산용) */
    private final ConcurrentHashMap<String, Instant> countdownEndTimes = new ConcurrentHashMap<>();
    /** 결과 화면 자동 승격 예약 */
    private final ConcurrentHashMap<String, ScheduledFuture<?>> nextRoundFutures = new ConcurrentHashMap<>();
    /** 결과 화면(FINISHED)에 있는 방. prepareNextRound 가 remove 로 한 번만 진행권을 얻는다. */
    private final Set<String> resultScreenRooms = ConcurrentHashMap.newKeySet();

    // ─── 의존성 ───────────────────────────────────────────────────────────────
    private final BattleRoomManager roomManager;
    private final BattleRoomRepository battleRoomRepository;
    private final BattleRankingService rankingService;
    private final ThreadPoolTaskScheduler taskScheduler;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private static final String GAME_KEY = "blockfall-battle";

    private final GameStatusService gameStatusService;

    public BattleRoomService(
            BattleRoomManager roomManager,
            BattleRoomRepository battleRoomRepository,
            BattleRankingService rankingService,
            GameStatusService gameStatusService,
            @Qualifier("battleTaskScheduler") ThreadPoolTaskScheduler taskScheduler) {
        this.gameStatusService = gameStatusService;
        this.roomManager = roomManager;
        this.battleRoomRepository = battleRoomRepository;
        this.rankingService = rankingService;
        this.taskScheduler = taskScheduler;
    }

    // ─── 매칭 ─────────────────────────────────────────────────────────────────

    /**
     * 자동 매칭: WAITING 방 탐색 → PLAYING 방 큐 → 신규 방 생성.
     * PRD §11 매칭 알고리즘.
     *
     * @return BattleJoinResponse
     */
    @Transactional
    public BattleJoinResponse joinBattle(Long userId, String guestId, boolean isGuest, String nickname) {
        String playerId = isGuest ? guestId : String.valueOf(userId);

        // EC-8: 이미 방(활성 또는 큐)에 참가 중인지 확인
        evictStaleOrThrow(playerId);

        gameStatusService.requireEnabled(GAME_KEY);

        BattleRoomManager.PlayerSessionInfo player = new BattleRoomManager.PlayerSessionInfo(
                playerId, nickname, isGuest, null, isGuest ? null : userId);

        // 1. WAITING 방 탐색, 없으면 2. PLAYING 방의 큐 (PRD §5.2)
        Optional<BattleRoom> existing = battleRoomRepository.findFirstByStatus(
                "WAITING", Sort.by(Sort.Direction.ASC, "createdAt"));
        if (existing.isEmpty()) {
            existing = battleRoomRepository.findFirstByStatus(
                    "PLAYING", Sort.by(Sort.Direction.ASC, "createdAt"));
        }

        if (existing.isPresent()) {
            BattleRoom room = existing.get();
            String roomId = room.getRoomId();
            // 게임 중·결과 화면·정원 초과면 큐로 들어간다. DB 상태가 아니라 인메모리 락 안에서 판정한다.
            boolean joined = roomManager.joinRoom(roomId, player);
            if (joined) {
                int playerCount = roomManager.getActivePlayers(roomId).size();
                room.setCurrentPlayers(playerCount);
                battleRoomRepository.save(room);

                broadcastRoomState(roomId);
                tryStartCountdown(roomId);

                return BattleJoinResponse.builder()
                        .roomId(roomId)
                        .status("WAITING")
                        .playerCount(playerCount)
                        .maxPlayers(MAX_PLAYERS)
                        .queuePosition(null)
                        .isGuest(isGuest)
                        .guestToken(isGuest ? guestId : null)
                        .playerId(playerId)
                        .build();
            }
            // 큐 진입 — queuePosition != null 이 큐 상태를 뜻한다
            int queuePos = roomManager.getQueueSize(roomId);
            room.setQueueCount(queuePos);
            battleRoomRepository.save(room);
            // PLAYING 으로 읽은 뒤 방이 결과 화면이 됐으면(큐가 비어 예약이 없었으면) 지금 예약한다
            if (resultScreenRooms.contains(roomId)) scheduleNextRound(roomId);
            broadcastRoomState(roomId);

            return BattleJoinResponse.builder()
                    .roomId(roomId)
                    .status(room.getStatus())
                    .playerCount(roomManager.getActivePlayers(roomId).size())
                    .maxPlayers(MAX_PLAYERS)
                    .queuePosition(queuePos)
                    .isGuest(isGuest)
                    .guestToken(isGuest ? guestId : null)
                    .playerId(playerId)
                    .build();
        }

        // 3. 신규 방 생성
        String newRoomId = generateRoomId();
        BattleRoom newRoom = BattleRoom.builder()
                .roomId(newRoomId)
                .status("WAITING")
                .maxPlayers(MAX_PLAYERS)
                .currentPlayers(1)
                .queueCount(0)
                .build();
        battleRoomRepository.save(newRoom);

        roomManager.joinRoom(newRoomId, player);
        broadcastRoomState(newRoomId);

        log.info("BattleRoomService.joinBattle: 신규 방 생성 roomId={} playerId={}", newRoomId, playerId);

        return BattleJoinResponse.builder()
                .roomId(newRoomId)
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(MAX_PLAYERS)
                .queuePosition(null)
                .isGuest(isGuest)
                .guestToken(isGuest ? guestId : null)
                .playerId(playerId)
                .build();
    }

    // ─── WebSocket 핸들러 진입점 ─────────────────────────────────────────────

    /**
     * 보드 상태 수신 → 다른 참가자에게 BOARD_UPDATE 전파 (에코 제외).
     * PRD §10.3.3
     */
    public void handleBoardState(String roomId, String senderPlayerId, BoardStateMessage msg) {
        // 큐 대기자·방 밖 사용자의 보드는 받지 않는다
        Optional<BattleRoomManager.PlayerSessionInfo> sender = roomManager.findActivePlayer(roomId, senderPlayerId);
        if (sender.isEmpty()) return;
        if (msg.getBoard() == null) {
            sendError(senderPlayerId, "INVALID_BOARD", "board 형식이 올바르지 않습니다.");
            return;
        }

        // BUG-COMM-02 수정: PlayerSessionInfo.score 갱신 (handlePlayerFinished 에서 사용)
        // + 새로고침 복원용 보드 스냅샷 캐시 갱신
        sender.get().updateGameStateCache(
                msg.getBoard(),
                msg.getScore(),
                msg.getLines(),
                msg.getLevel(),
                msg.getCombo());

        BoardUpdatePayload payload = BoardUpdatePayload.builder()
                .playerId(senderPlayerId)
                .board(msg.getBoard())
                .score(msg.getScore())
                .lines(msg.getLines())
                .level(msg.getLevel())
                .build();

        BattleEnvelope envelope = buildEnvelope("BOARD_UPDATE", payload);

        // 발신자 제외 브로드캐스트
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        players.stream()
                .filter(p -> !p.getPlayerId().equals(senderPlayerId))
                .forEach(p -> messagingTemplate.convertAndSendToUser(
                        p.getPlayerId(), "/queue/blockfall-battle/board", envelope));
    }

    /**
     * 콤보 공격 처리 → GARBAGE_ATTACK 전송.
     * PRD §7
     */
    public void handleComboAttack(String roomId, String fromPlayerId, ComboAttackMessage msg) {
        if (roomManager.findActivePlayer(roomId, fromPlayerId).isEmpty()) return;
        int combo = msg.getCombo();
        if (combo < 0) {
            sendError(fromPlayerId, "INVALID_COMBO", "combo 값이 유효하지 않습니다.");
            return;
        }

        int lines = comboToGarbageLines(combo);
        if (lines <= 0) return; // 1콤보는 공격 없음

        List<BattleRoomManager.PlayerSessionInfo> aliveOthers = roomManager.getAlivePlayers(roomId)
                .stream()
                .filter(p -> !p.getPlayerId().equals(fromPlayerId))
                .collect(Collectors.toList());

        if (aliveOthers.isEmpty()) {
            // EC-4: 살아있는 다른 플레이어 없음
            return;
        }

        // 대상 선정
        String targetId = msg.getTargetPlayerId();
        BattleRoomManager.PlayerSessionInfo target = null;

        if (targetId != null) {
            // 명시된 대상이 살아있으면 우선
            target = aliveOthers.stream()
                    .filter(p -> p.getPlayerId().equals(targetId))
                    .findFirst()
                    .orElse(null);
        }

        if (target == null) {
            // 랜덤 선택
            target = aliveOthers.get(new Random().nextInt(aliveOthers.size()));
        }

        GarbageAttackPayload payload = GarbageAttackPayload.builder()
                .targetPlayerId(target.getPlayerId())
                .lines(lines)
                .fromPlayerId(fromPlayerId)
                .build();

        broadcast(roomId, "GARBAGE_ATTACK", payload);
        log.debug("BattleRoomService.handleComboAttack: from={} target={} lines={}", fromPlayerId, target.getPlayerId(), lines);
    }

    /**
     * 세션 끊김(SessionDisconnectEvent) 처리 — 15초 grace period 후 제거.
     * 재연결 시 registerSession이 sessionRoomMap에서 old sessionId를 제거하므로
     * removePlayer(oldSessionId) 가 null을 반환하여 제거가 취소됨.
     * PRD §10.3.8
     */
    public void handleLeaveBySession(String sessionId) {
        String roomId = roomManager.getRoomIdBySession(sessionId);
        if (roomId == null) return;

        // T48-RISK1: 유예 중인 사람은 시작 판정에서 빠진다 — 연결된 사람이 2명 미만이 되면 카운트다운을 멈춘다
        roomManager.markDisconnected(sessionId);
        cancelCountdownIfNeeded(roomId);
        // 결과 화면: 남은 연결된 사람(2명 이상)이 모두 준비했으면 유예를 기다리지 않고 다음 라운드로.
        // 혼자 남음(D-38)은 순간 끊김에 대기실로 밀리지 않게 유예가 끝날 때 판정한다.
        if (resultScreenRooms.contains(roomId)) startNextRoundIfAllReady(roomId, false);

        final String capturedRoomId = roomId;
        taskScheduler.schedule(() -> {
            // old sessionId가 여전히 map에 있으면 재연결 안 한 것 → 실제 제거
            BattleRoomManager.PlayerSessionInfo player = roomManager.removePlayer(sessionId);
            if (player == null) return; // 재연결 성공 → sessionId 이미 갱신됨 → 무시
            handleLeaveInternal(capturedRoomId, player);
        }, Instant.now().plusSeconds(RECONNECT_GRACE_SECONDS));
    }

    /**
     * WS 연결(첫 연결·재연결) 때 세션을 등록한다. 유예 중이던 사람이 돌아오면 다시 시작 판정에 들어간다:
     * 대기실이면 카운트다운을 다시 검토하고(정원이 차도 즉시 시작하지 않는다 — 돌아온 사람이 구독하기 전이다),
     * 결과 화면이면 준비 수를 다시 알린다. 혼자 남은 결과 화면은 그대로 두고 준비로 진행한다(D-38).
     */
    public void registerSession(String playerId, String sessionId) {
        roomManager.findRoomIdByPlayerId(playerId).ifPresent(roomId -> {
            if (!roomManager.registerSession(roomId, playerId, sessionId)) return;
            if (resultScreenRooms.contains(roomId)) {
                startNextRoundIfAllReady(roomId, false);
            } else {
                tryStartCountdown(roomId, false);
            }
        });
    }

    /**
     * 자발적 이탈(LEAVE 메시지) 처리 — 즉시 제거.
     * PRD §10.3.8
     */
    public void handleExplicitLeave(String sessionId) {
        String roomId = roomManager.getRoomIdBySession(sessionId);
        BattleRoomManager.PlayerSessionInfo player = roomManager.removePlayer(sessionId);
        if (player == null || roomId == null) return;
        handleLeaveInternal(roomId, player);
    }

    private void handleLeaveInternal(String roomId, BattleRoomManager.PlayerSessionInfo player) {
        String playerId = player.getPlayerId();

        // 큐 대기자는 게임에 없으므로 순위·카운트다운과 무관하다. 인원과 큐 순서만 갱신한다.
        if (player.isQueued()) {
            updateRoomDB(roomId);
            broadcastRoomState(roomId);
            updateQueuePositions(roomId);
            closeIfFinishedAndEmpty(roomId);
            return;
        }

        // BUG-004 수정: 자발적 이탈 플래그 설정 → finishGame 전적 저장 제외
        player.setVoluntaryLeft(true);

        // 카운트다운 중이라면 취소 검토
        cancelCountdownIfNeeded(roomId);

        // 게임 중 이탈이면 PLAYER_FINISHED 처리 (removePlayer 이후이므로 현재 alive 수 + 1 = rank)
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        boolean leftResultScreen = room != null && "FINISHED".equals(room.getStatus());
        if (room != null && "PLAYING".equals(room.getStatus()) && player.isAlive()) {
            int aliveCount = roomManager.getAlivePlayers(roomId).size();
            int rank = aliveCount + 1; // 이미 제거된 상태이므로 +1

            PlayerFinishedPayload finishedPayload = PlayerFinishedPayload.builder()
                    .playerId(playerId)
                    .rank(rank)
                    .score(player.getScore())
                    .build();
            broadcast(roomId, "PLAYER_FINISHED", finishedPayload);
        }

        // PLAYER_LEFT 브로드캐스트
        PlayerLeftPayload leftPayload = PlayerLeftPayload.builder()
                .playerId(playerId)
                .nickname(player.getNickname())
                .build();
        broadcast(roomId, "PLAYER_LEFT", leftPayload);

        // 대기 방의 빈자리는 새로 오는 사람보다 큐 대기자가 먼저 채운다
        if (room != null && "WAITING".equals(room.getStatus()) && roomManager.getQueueSize(roomId) > 0) {
            roomManager.fillFromQueue(roomId);
            updateQueuePositions(roomId);
            tryStartCountdown(roomId);
        }

        // 방 상태 갱신
        updateRoomDB(roomId);
        broadcastRoomState(roomId);

        // 살아있는 플레이어가 1명 남으면 자동 우승 처리
        checkAutoWin(roomId);

        // WAITING 상태에서 방이 비면 즉시 정리 (listWaitingRooms 유령 방 방지)
        if (roomManager.getActivePlayers(roomId).isEmpty()) {
            battleRoomRepository.findByRoomId(roomId).ifPresent(r -> {
                if ("WAITING".equals(r.getStatus())) {
                    r.setStatus("FINISHED");
                    battleRoomRepository.save(r);
                    roomManager.cleanupRoom(roomId);
                    log.info("BattleRoomService: roomId={} WAITING 빈 방 정리 완료", roomId);
                }
            });
        }

        // 결과 화면에서 나간 경우(T-46): 남은 사람이 이미 모두 준비했으면 다음 라운드를 연다
        if (leftResultScreen) {
            if (closeIfFinishedAndEmpty(roomId)) return;
            startNextRoundIfAllReady(roomId, true);
        }
    }

    /**
     * 결과 화면 방에 활성 참가자도 큐도 없으면 닫는다. 자동 승격 예약도 취소한다.
     * @return 닫았으면 true
     */
    private boolean closeIfFinishedAndEmpty(String roomId) {
        if (!roomManager.getActivePlayers(roomId).isEmpty() || roomManager.getQueueSize(roomId) > 0) {
            return false;
        }
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null || !"FINISHED".equals(room.getStatus())) return false;
        cancelNextRound(roomId);
        resultScreenRooms.remove(roomId);
        room.setClosedAt(LocalDateTime.now());
        battleRoomRepository.save(room);
        roomManager.cleanupRoom(roomId);
        log.info("BattleRoomService: roomId={} 결과 화면 빈 방 정리 완료", roomId);
        return true;
    }

    /**
     * 결과 화면에서 준비 상태를 다시 알리고, 남은 활성 참가자(2명 이상)가 모두 준비했으면 다음 라운드로.
     * D-38: 혼자 남으면 10초 타이머를 기다리지 않고 바로 대기실(WAITING)로 돌린다 — 큐 대기자는 이때 승격되고,
     * 큐가 없으면 자동 매칭(WAITING 검색)이 새 상대를 넣는다. 남은 타이머는 prepareNextRound 가 취소한다.
     * T48-RISK1: 끊김 유예 중인 사람은 세지 않는다. 유예 중인 사람만 남으면 열지 않고, 유예가 끝날 때 방이 닫힌다.
     * @param soloToWaiting 혼자 남았을 때 대기실로 돌릴지 (퇴장 때만 true — 끊김·재연결 때는 준비를 기다린다)
     */
    private void startNextRoundIfAllReady(String roomId, boolean soloToWaiting) {
        int activeCount = roomManager.getConnectedPlayers(roomId).size();
        int readyCount = roomManager.getConnectedReadyCount(roomId);
        broadcast(roomId, "READY_STATE", ReadyStatePayload.builder()
                .readyCount(readyCount)
                .totalCount(activeCount)
                .build());
        if (gameStatusService.isDisabled(GAME_KEY)) return;
        if ((soloToWaiting && activeCount == 1) || (activeCount >= 2 && readyCount >= activeCount)) {
            roomManager.clearReadySet(roomId);
            prepareNextRound(roomId);
        }
    }

    /**
     * 플레이어 게임오버 처리 — WebSocket 진입점 (score 는 인메모리 상태 사용).
     * BUG-001 수정: /player-finished WebSocket 핸들러에서 호출.
     * PRD §10.3.5
     */
    public void handlePlayerFinished(String roomId, String playerId) {
        // 인메모리에 저장된 현재 score 사용
        List<BattleRoomManager.PlayerSessionInfo> activePlayers = roomManager.getActivePlayers(roomId);
        int currentScore = activePlayers.stream()
                .filter(p -> p.getPlayerId().equals(playerId))
                .mapToInt(BattleRoomManager.PlayerSessionInfo::getScore)
                .findFirst()
                .orElse(0);
        handlePlayerFinished(roomId, playerId, currentScore);
    }

    /**
     * 플레이어 게임오버 처리 (Block Out).
     * PRD §10.3.5
     */
    public void handlePlayerFinished(String roomId, String playerId, int score) {
        // 큐 대기자·방 밖 사용자·이미 끝난 참가자는 순위를 만들 수 없다
        boolean aliveMember = roomManager.findActivePlayer(roomId, playerId)
                .map(BattleRoomManager.PlayerSessionInfo::isAlive)
                .orElse(false);
        if (!aliveMember) return;

        List<BattleRoomManager.PlayerSessionInfo> alivePlayers = roomManager.getAlivePlayers(roomId);
        int aliveCount = alivePlayers.size();

        // 종료 순위: 현재 alive 수가 곧 이 플레이어의 rank (나중에 죽을수록 높음)
        // 마지막 생존 = rank 1 → 첫 사망 = rank = 시작 player 수
        // 구현: rank = 현재 alive 수 (본인 포함)
        int rank = aliveCount; // 본인이 포함된 상태에서 죽으므로 alive 수가 rank

        roomManager.markFinished(roomId, playerId, score, rank);

        PlayerFinishedPayload payload = PlayerFinishedPayload.builder()
                .playerId(playerId)
                .rank(rank)
                .score(score)
                .build();
        broadcast(roomId, "PLAYER_FINISHED", payload);
        log.info("BattleRoomService.handlePlayerFinished: roomId={} playerId={} rank={}", roomId, playerId, rank);

        // 1명 이하 남으면 게임 종료
        checkAutoWin(roomId);
    }

    // ─── 카운트다운 ───────────────────────────────────────────────────────────

    /**
     * 인원 ≥ 2 이면 5초 카운트다운 시작.
     * 4인 꽉 차면 즉시 시작 (OQ-3 결정: 즉시 시작).
     */
    public void tryStartCountdown(String roomId) {
        tryStartCountdown(roomId, true);
    }

    private void tryStartCountdown(String roomId, boolean startNowIfFull) {
        // T48-RISK1: 끊김 유예 중인 사람은 세지 않는다
        int count = roomManager.getConnectedPlayers(roomId).size();

        if (count < 2) return;

        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null || !"WAITING".equals(room.getStatus())) return;

        if (startNowIfFull && count >= MAX_PLAYERS) {
            // 즉시 시작 (이미 카운트다운 중이면 취소 후 즉시)
            ScheduledFuture<?> existing = countdownFutures.remove(roomId);
            if (existing != null) existing.cancel(false);
            broadcast(roomId, "MATCH_COUNTDOWN", MatchCountdownPayload.builder().secondsRemaining(0).build());
            startGame(roomId);
            return;
        }

        // BUG-006 수정: putIfAbsent 원자적 등록 먼저 수행, 성공한 경우에만 브로드캐스트.
        // 브로드캐스트가 등록 전에 실행되면 동시 진입 시 MATCH_COUNTDOWN 중복 수신 가능.
        Instant endTime = Instant.now().plusSeconds(COUNTDOWN_SECONDS);
        ScheduledFuture<?> future = taskScheduler.schedule(() -> startGame(roomId), endTime);
        ScheduledFuture<?> prev = countdownFutures.putIfAbsent(roomId, future);
        if (prev != null) {
            // 이미 다른 Future 가 등록되어 있음 — 새로 만든 것 취소, 브로드캐스트 없음
            future.cancel(false);
            return;
        }
        countdownEndTimes.put(roomId, endTime);
        // 원자적 등록 성공 후 브로드캐스트 (1회만 발생 보장)
        broadcast(roomId, "MATCH_COUNTDOWN", MatchCountdownPayload.builder().secondsRemaining(COUNTDOWN_SECONDS).build());
        log.debug("BattleRoomService.tryStartCountdown: roomId={} seconds={}", roomId, COUNTDOWN_SECONDS);
    }

    private void cancelCountdownIfNeeded(String roomId) {
        if (roomManager.getConnectedPlayers(roomId).size() < 2) {
            ScheduledFuture<?> future = countdownFutures.remove(roomId);
            if (future != null && !future.isDone()) {
                future.cancel(false);
                countdownEndTimes.remove(roomId);
                broadcast(roomId, "MATCH_COUNTDOWN_CANCELLED", MatchCountdownPayload.builder().secondsRemaining(0).build());
                log.debug("BattleRoomService.cancelCountdown: roomId={}", roomId);
            }
        }
    }

    // ─── 게임 시작/종료 ───────────────────────────────────────────────────────

    @Transactional
    public void startGame(String roomId) {
        countdownFutures.remove(roomId);
        countdownEndTimes.remove(roomId);
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null) return;

        // WAITING 상태에서만 시작
        if (!"WAITING".equals(room.getStatus())) return;

        // 이 시점부터 들어오는 사람은 큐로 간다. 같은 락에서 뜬 스냅샷이 이번 판의 참가자다.
        // 끊김 유예 중인 사람은 판에 넣지 않고 큐로 옮긴다(T48-RISK1).
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.closeToJoin(roomId);
        if (players.size() < 2) {
            roomManager.reopenToJoin(roomId);
            return;
        }

        room.setStatus("PLAYING");
        room.setStartedAt(LocalDateTime.now());
        room.setCurrentPlayers(players.size());
        room.setQueueCount(roomManager.getQueueSize(roomId));
        battleRoomRepository.save(room);

        // 새 라운드 시작 — 모든 플레이어의 보드 스냅샷 캐시 초기화
        players.forEach(BattleRoomManager.PlayerSessionInfo::clearGameStateCache);

        String startAt = Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_INSTANT);

        List<PlayerInfo> playerInfos = players.stream()
                .map(p -> PlayerInfo.builder()
                        .id(p.getPlayerId())
                        .nickname(p.getNickname())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        GameStartedPayload payload = GameStartedPayload.builder()
                .roomId(roomId)
                .players(playerInfos)
                .startAt(startAt)
                .build();

        broadcast(roomId, "GAME_STARTED", payload);
        updateQueuePositions(roomId);
        log.info("BattleRoomService.startGame: roomId={} players={}", roomId, players.size());
    }

    /** 살아있는 플레이어가 1명 이하일 때 게임 종료 처리 */
    private void checkAutoWin(String roomId) {
        List<BattleRoomManager.PlayerSessionInfo> alivePlayers = roomManager.getAlivePlayers(roomId);
        List<BattleRoomManager.PlayerSessionInfo> allPlayers = roomManager.getActivePlayers(roomId);

        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null || !"PLAYING".equals(room.getStatus())) return;

        boolean gameOver = alivePlayers.size() <= 1 ||
                (alivePlayers.isEmpty() && !allPlayers.isEmpty());

        if (!gameOver) return;

        // 마지막 생존자 rank=1
        if (alivePlayers.size() == 1) {
            BattleRoomManager.PlayerSessionInfo winner = alivePlayers.get(0);
            roomManager.markFinished(roomId, winner.getPlayerId(), winner.getScore(), 1);

            PlayerFinishedPayload winPayload = PlayerFinishedPayload.builder()
                    .playerId(winner.getPlayerId())
                    .rank(1)
                    .score(winner.getScore())
                    .build();
            broadcast(roomId, "PLAYER_FINISHED", winPayload);
        }

        finishGame(roomId);
    }

    @Transactional
    public void finishGame(String roomId) {
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null) return;

        // ① 상태 먼저 FINISHED로 저장 후 flush — 이후 예외가 나도 롤백되지 않도록
        room.setStatus("FINISHED");
        room.setFinishedAt(LocalDateTime.now());
        battleRoomRepository.save(room);
        battleRoomRepository.flush();

        // ② 전적 업데이트 (로그인 유저만, BUG-004: 자발적 이탈자 제외)
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        players.stream()
                .filter(p -> !p.isGuest() && p.getUserId() != null && !p.isVoluntaryLeft())
                .forEach(p -> {
                    boolean isWinner = p.getRank() == 1;
                    try {
                        rankingService.updateRecord(p.getUserId(), isWinner);
                    } catch (Exception e) {
                        log.error("BattleRoomService.finishGame: 전적 업데이트 실패 userId={}", p.getUserId(), e);
                    }
                });

        // ③ 상위 랭킹 조회 (실패해도 빈 리스트로 fallback — DB 미마이그레이션 방어)
        List<BattleRankingResponse.RankingEntry> topRankings;
        try {
            topRankings = rankingService.getTopRankings();
        } catch (Exception e) {
            log.warn("BattleRoomService.finishGame: getTopRankings 실패 (DB 미마이그레이션?), 빈 리스트로 대체", e);
            topRankings = Collections.emptyList();
        }

        // ④ GAME_RESULT 브로드캐스트
        List<GameResultPayload.ResultEntry> results = players.stream()
                .sorted(Comparator.comparingInt(BattleRoomManager.PlayerSessionInfo::getRank))
                .map(p -> GameResultPayload.ResultEntry.builder()
                        .rank(p.getRank())
                        .playerId(p.getPlayerId())
                        .nickname(p.getNickname())
                        .score(p.getScore())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        GameResultPayload resultPayload = GameResultPayload.builder()
                .roomId(roomId)
                .results(results)
                .topRankings(topRankings)
                .build();
        broadcast(roomId, "GAME_RESULT", resultPayload);
        log.info("BattleRoomService.finishGame: roomId={} GAME_RESULT 브로드캐스트", roomId);

        // ⑤ 큐에 사람이 있으면 10초 뒤 자동 승격, 없으면 Ready 시스템 대기. 아무도 없으면 방 정리.
        // 결과 화면 표시를 큐 확인보다 먼저 남긴다 — 동시에 큐로 들어온 사람은 joinBattle 쪽에서 예약한다.
        resultScreenRooms.add(roomId);
        if (roomManager.getQueueSize(roomId) > 0) {
            scheduleNextRound(roomId);
            broadcastRoomState(roomId);
        } else if (players.isEmpty()) {
            resultScreenRooms.remove(roomId);
            room.setClosedAt(LocalDateTime.now());
            battleRoomRepository.save(room);
            roomManager.cleanupRoom(roomId);
            log.info("BattleRoomService.finishGame: roomId={} 플레이어 없음 → 방 정리", roomId);
        }
    }

    /**
     * 결과 화면 뒤 자동 승격 예약. 이미 예약돼 있으면 그대로 둔다.
     * 예약 뒤 큐가 비어도 화면 카운트다운과 맞추려고 그대로 진행한다.
     */
    private void scheduleNextRound(String roomId) {
        nextRoundFutures.computeIfAbsent(roomId, id -> taskScheduler.schedule(
                () -> autoNextRound(id), Instant.now().plusSeconds(AUTO_NEXT_ROUND_SECONDS)));
    }

    private void autoNextRound(String roomId) {
        nextRoundFutures.remove(roomId);
        // 꺼진 게임은 다음 라운드를 열지 않는다 (T-33 Ready 차단과 동일).
        // 큐 대기자가 갇히지 않게 다시 예약해 두고, 켜지면 그때 승격한다.
        if (gameStatusService.isDisabled(GAME_KEY)) {
            scheduleNextRound(roomId);
            broadcastRoomState(roomId);
            return;
        }
        roomManager.clearReadySet(roomId);
        prepareNextRound(roomId);
    }

    private void cancelNextRound(String roomId) {
        ScheduledFuture<?> future = nextRoundFutures.remove(roomId);
        if (future != null) future.cancel(false);
    }

    /** 자동 승격까지 남은 초 (올림). 예약이 없으면 null. */
    private Integer nextRoundInSeconds(String roomId) {
        ScheduledFuture<?> future = nextRoundFutures.get(roomId);
        if (future == null) return null;
        long millis = future.getDelay(TimeUnit.MILLISECONDS);
        return (int) Math.max(0, (millis + 999) / 1000);
    }

    /**
     * 결과 화면에서 플레이어가 "준비" 클릭.
     * 전원 준비 완료 시 다음 라운드 시작.
     */
    public void handlePlayerReady(String roomId, String playerId) {
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null || !"FINISHED".equals(room.getStatus())) {
            log.debug("handlePlayerReady: roomId={} 방 없음 또는 FINISHED 아님, 무시", roomId);
            return;
        }

        // 방 밖의 사용자가 준비 수를 채워 다음 라운드를 열 수 없게 한다.
        List<BattleRoomManager.PlayerSessionInfo> members = roomManager.getActivePlayers(roomId);
        if (members.stream().noneMatch(p -> p.getPlayerId().equals(playerId))) {
            sendError(playerId, "NOT_IN_ROOM", "해당 방에 참가하지 않았습니다.");
            return;
        }

        // 꺼진 게임은 다음 라운드를 열지 않는다. 이미 준비한 사람의 표시도 되돌린다.
        if (gameStatusService.isDisabled(GAME_KEY)) {
            roomManager.clearReadySet(roomId);
            broadcast(roomId, "READY_STATE", ReadyStatePayload.builder()
                    .readyCount(0)
                    .totalCount(roomManager.getConnectedPlayers(roomId).size())
                    .build());
            sendError(playerId, GameDisabledException.CODE, GameDisabledException.USER_MESSAGE);
            return;
        }

        roomManager.markPlayerReady(roomId, playerId);
        log.debug("handlePlayerReady: roomId={} playerId={}", roomId, playerId);
        // READY_STATE 를 알리고, 연결된 사람이 모두 준비했거나 혼자 남았으면(D-38) 다음 라운드로.
        // T48-RISK1: 준비한 뒤 끊긴 사람(유예 중)은 준비 수에도 전체 수에도 넣지 않는다.
        startNextRoundIfAllReady(roomId, true);
    }

    /**
     * FINISHED → WAITING 전이 + 큐 승격.
     * PRD §5.2
     */
    @Transactional
    public void prepareNextRound(String roomId) {
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        // 결과 화면에서만 진행한다 — 전원 준비와 자동 승격 타이머가 겹쳐도 remove 에 성공한 한 쪽만 실행된다
        if (room == null || !"FINISHED".equals(room.getStatus())) return;
        if (!resultScreenRooms.remove(roomId)) return;
        cancelNextRound(roomId);

        // 큐에서 빈 자리만큼 승격 (기존 참가자 + 큐 대기자)
        List<BattleRoomManager.PlayerSessionInfo> promoted = roomManager.fillFromQueue(roomId);
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);

        if (players.isEmpty()) {
            // 전원 퇴장 → 방 닫기
            room.setStatus("FINISHED");
            room.setClosedAt(LocalDateTime.now());
            battleRoomRepository.save(room);
            roomManager.cleanupRoom(roomId);
            log.info("BattleRoomService.prepareNextRound: roomId={} 전원 퇴장 → 방 닫힘", roomId);
            return;
        }

        room.setStatus("WAITING");
        room.setCurrentPlayers(players.size());
        room.setQueueCount(roomManager.getQueueSize(roomId));
        room.setFinishedAt(null);
        room.setStartedAt(null);
        battleRoomRepository.save(room);

        broadcastRoomState(roomId);

        // 큐 대기자 QUEUE_POSITION 업데이트
        updateQueuePositions(roomId);

        // 인원 ≥ 2 이면 카운트다운
        if (players.size() >= 2) {
            tryStartCountdown(roomId);
        }

        log.info("BattleRoomService.prepareNextRound: roomId={} WAITING 전이 promoted={}", roomId, promoted.size());
    }

    // ─── 상태 catch-up ────────────────────────────────────────────────────────

    /**
     * WS 연결 직후 요청자(플레이어)에게 현재 방 상태를 개인 채널로 전송.
     * REST join → WS 구독 사이에 브로드캐스트된 MATCH_COUNTDOWN을 놓친 플레이어를 위한 catch-up.
     */
    public void handleRequestState(String roomId, String playerId) {
        // T-41(R7): 방 밖의 사용자에게는 아무것도 보내지 않는다. 큐 사용자는 순번 표시에 ROOM_STATE 가 필요하므로 받는다.
        if (!roomManager.isPlayerInRoom(roomId, playerId)) return;

        // ROOM_STATE 개인 전송
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        RoomStatePayload roomStatePayload = buildRoomState(roomId);
        String status = roomStatePayload.getStatus();
        messagingTemplate.convertAndSendToUser(
                playerId, "/queue/blockfall-battle/state", buildEnvelope("ROOM_STATE", roomStatePayload));

        // 큐 대기자에게는 자기 순번을 알려 준다
        List<BattleRoomManager.PlayerSessionInfo> queue = roomManager.getQueuePlayers(roomId);
        for (int i = 0; i < queue.size(); i++) {
            if (queue.get(i).getPlayerId().equals(playerId)) {
                sendQueuePosition(playerId, i + 1, queue.size());
                break;
            }
        }

        // 새로고침 복원 — PLAYING 상태이고 본인 게임 스냅샷이 캐싱돼 있으면 MY_GAME_STATE 전송
        if ("PLAYING".equals(status)) {
            players.stream()
                    .filter(p -> p.getPlayerId().equals(playerId))
                    .filter(BattleRoomManager.PlayerSessionInfo::isHasGameStateCache)
                    .findFirst()
                    .ifPresent(p -> {
                        MyGameStatePayload myState = MyGameStatePayload.builder()
                                .playerId(playerId)
                                .board(p.getLastBoard())
                                .score(p.getScore())
                                .lines(p.getLastLines())
                                .level(p.getLastLevel())
                                .combo(p.getLastCombo())
                                .build();
                        messagingTemplate.convertAndSendToUser(
                                playerId, "/queue/blockfall-battle/state",
                                buildEnvelope("MY_GAME_STATE", myState));
                        log.debug("handleRequestState: catch-up MY_GAME_STATE roomId={} playerId={}", roomId, playerId);
                    });
        }

        // 카운트다운 진행 중이면 남은 초 계산 후 개인 전송
        Instant endTime = countdownEndTimes.get(roomId);
        if (endTime != null) {
            long remaining = endTime.getEpochSecond() - Instant.now().getEpochSecond();
            if (remaining > 0) {
                messagingTemplate.convertAndSendToUser(
                        playerId, "/queue/blockfall-battle/state",
                        buildEnvelope("MATCH_COUNTDOWN",
                                MatchCountdownPayload.builder().secondsRemaining((int) remaining).build()));
                log.debug("handleRequestState: catch-up MATCH_COUNTDOWN roomId={} playerId={} remaining={}",
                        roomId, playerId, remaining);
            }
        }
    }

    // ─── 브로드캐스트 헬퍼 ───────────────────────────────────────────────────

    private void broadcast(String roomId, String type, Object payload) {
        BattleEnvelope envelope = buildEnvelope(type, payload);
        messagingTemplate.convertAndSend(TOPIC_PREFIX + roomId, envelope);
    }

    private void broadcastRoomState(String roomId) {
        broadcast(roomId, "ROOM_STATE", buildRoomState(roomId));
    }

    private RoomStatePayload buildRoomState(String roomId) {
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        String status = room != null ? room.getStatus() : "WAITING";

        List<PlayerInfo> playerInfos = roomManager.getActivePlayers(roomId).stream()
                .map(p -> PlayerInfo.builder()
                        .id(p.getPlayerId())
                        .nickname(p.getNickname())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        return RoomStatePayload.builder()
                .roomId(roomId)
                .status(status)
                .players(playerInfos)
                .queueCount(roomManager.getQueueSize(roomId))
                .nextRoundInSeconds("FINISHED".equals(status) ? nextRoundInSeconds(roomId) : null)
                .build();
    }

    private void sendError(String playerId, String code, String message) {
        BattleEnvelope envelope = buildEnvelope("ERROR",
                Map.of("code", code, "message", message));
        messagingTemplate.convertAndSendToUser(playerId, "/queue/blockfall-battle/errors", envelope);
    }

    private void updateQueuePositions(String roomId) {
        List<BattleRoomManager.PlayerSessionInfo> queue = roomManager.getQueuePlayers(roomId);
        int total = queue.size();
        for (int i = 0; i < queue.size(); i++) {
            sendQueuePosition(queue.get(i).getPlayerId(), i + 1, total);
        }
    }

    private void sendQueuePosition(String playerId, int position, int total) {
        QueuePositionPayload qp = QueuePositionPayload.builder()
                .position(position)
                .totalInQueue(total)
                .build();
        messagingTemplate.convertAndSendToUser(
                playerId, "/queue/blockfall-battle/queue", buildEnvelope("QUEUE_POSITION", qp));
    }

    @Transactional
    public void updateRoomDB(String roomId) {
        battleRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setCurrentPlayers(roomManager.getActivePlayers(roomId).size());
            room.setQueueCount(roomManager.getQueueSize(roomId));
            battleRoomRepository.save(room);
        });
    }

    // ─── 유틸 ────────────────────────────────────────────────────────────────

    /**
     * 콤보 횟수 → Garbage Line 줄 수 매핑.
     * PRD §7.1
     */
    private int comboToGarbageLines(int combo) {
        if (combo <= 1) return 0;
        if (combo == 2) return 1;
        if (combo == 3) return 2;
        if (combo == 4) return 3;
        return 4; // 5 이상 → 4 상한
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

    private BattleEnvelope buildEnvelope(String type, Object payload) {
        return BattleEnvelope.builder()
                .type(type)
                .timestamp(Instant.now().atZone(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_INSTANT))
                .payload(payload)
                .build();
    }

    public Map<String, Integer> getRoomStats() {
        return Map.of(
            "activeRooms",   roomManager.getActiveRoomCount(),
            "activePlayers", roomManager.getActiveTotalPlayerCount()
        );
    }

    // ─── 방 목록 조회 ─────────────────────────────────────────────────────────

    /**
     * GET /api/blockfall-battle/rooms/waiting
     * DB에서 WAITING 방 목록 조회 (최대 20개, 생성 순).
     */
    @Transactional(readOnly = true)
    public List<WaitingRoomInfo> listWaitingRooms() {
        return battleRoomRepository.findByStatusIn(List.of("WAITING")).stream()
                .limit(20)
                .sorted(Comparator.comparing(r -> r.getCreatedAt() != null ? r.getCreatedAt() : LocalDateTime.MIN))
                .map(room -> {
                    String hostNickname = roomManager.getActivePlayers(room.getRoomId())
                            .stream()
                            .findFirst()
                            .map(BattleRoomManager.PlayerSessionInfo::getNickname)
                            .orElse(null);
                    String createdAt = room.getCreatedAt() != null
                            ? room.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                            : null;
                    return WaitingRoomInfo.builder()
                            .roomId(room.getRoomId())
                            .currentPlayers(room.getCurrentPlayers())
                            .maxPlayers(MAX_PLAYERS)
                            .hostNickname(hostNickname)
                            .createdAt(createdAt)
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ─── 방 직접 생성 ─────────────────────────────────────────────────────────

    /**
     * POST /api/blockfall-battle/create — 신규 방 생성만 (자동 합류 없음).
     */
    @Transactional
    public BattleJoinResponse createRoomOnly(Long userId, String guestId, boolean isGuest, String nickname) {
        String playerId = isGuest ? guestId : String.valueOf(userId);

        evictStaleOrThrow(playerId);

        gameStatusService.requireEnabled(GAME_KEY);

        BattleRoomManager.PlayerSessionInfo player = new BattleRoomManager.PlayerSessionInfo(
                playerId, nickname, isGuest, null, isGuest ? null : userId);

        String newRoomId = generateRoomId();
        BattleRoom newRoom = BattleRoom.builder()
                .roomId(newRoomId)
                .status("WAITING")
                .maxPlayers(MAX_PLAYERS)
                .currentPlayers(1)
                .queueCount(0)
                .build();
        battleRoomRepository.save(newRoom);

        roomManager.joinRoom(newRoomId, player);
        broadcastRoomState(newRoomId);

        log.info("BattleRoomService.createRoomOnly: 신규 방 생성 roomId={} playerId={}", newRoomId, playerId);

        return BattleJoinResponse.builder()
                .roomId(newRoomId)
                .status("WAITING")
                .playerCount(1)
                .maxPlayers(MAX_PLAYERS)
                .queuePosition(null)
                .isGuest(isGuest)
                .guestToken(isGuest ? guestId : null)
                .playerId(playerId)
                .build();
    }

    // ─── 방 직접 입장 ─────────────────────────────────────────────────────────

    /**
     * POST /api/blockfall-battle/join/{roomId} — 특정 방에 직접 입장.
     */
    @Transactional
    public BattleJoinResponse joinSpecificRoom(String roomId, Long userId, String guestId, boolean isGuest, String nickname) {
        String playerId = isGuest ? guestId : String.valueOf(userId);

        evictStaleOrThrow(playerId);

        gameStatusService.requireEnabled(GAME_KEY);

        BattleRoom room = battleRoomRepository.findByRoomId(roomId)
                .orElseThrow(RoomNotFoundException::new);

        if (!"WAITING".equals(room.getStatus())) {
            throw new RoomFullOrStartedException();
        }

        BattleRoomManager.PlayerSessionInfo player = new BattleRoomManager.PlayerSessionInfo(
                playerId, nickname, isGuest, null, isGuest ? null : userId);

        // 직접 입장은 큐로 들어가지 않는다 — 막히면 아무 데도 남기지 않고 거절
        boolean joined = roomManager.joinRoom(roomId, player, false);
        if (!joined) {
            throw new RoomFullOrStartedException();
        }

        int playerCount = roomManager.getActivePlayers(roomId).size();
        room.setCurrentPlayers(playerCount);
        battleRoomRepository.save(room);

        broadcastRoomState(roomId);
        tryStartCountdown(roomId);

        return BattleJoinResponse.builder()
                .roomId(roomId)
                .status("WAITING")
                .playerCount(playerCount)
                .maxPlayers(MAX_PLAYERS)
                .queuePosition(null)
                .isGuest(isGuest)
                .guestToken(isGuest ? guestId : null)
                .playerId(playerId)
                .build();
    }

    /**
     * 이미 방(활성 또는 큐)에 있으면 ALREADY_IN_ROOM.
     * 단, REST join 후 WS 연결이 안 된(sessionId == null) 항목은 제거하고 재진입을 허용한다.
     */
    private void evictStaleOrThrow(String playerId) {
        Optional<String> existingRoom = roomManager.findRoomIdByPlayerId(playerId);
        if (existingRoom.isEmpty()) return;
        String existingRoomId = existingRoom.get();
        Optional<BattleRoomManager.PlayerSessionInfo> stale = roomManager.findPlayer(existingRoomId, playerId);
        if (stale.isPresent() && stale.get().getSessionId() == null) {
            BattleRoomManager.PlayerSessionInfo removed = roomManager.removePlayerById(existingRoomId, playerId);
            // 일반 퇴장과 같게 처리한다 — 카운트다운 취소, 자동 우승, 큐 순번, 빈 방 정리
            if (removed != null) handleLeaveInternal(existingRoomId, removed);
            log.info("stale(sessionless) entry evicted roomId={} playerId={}", existingRoomId, playerId);
            return;
        }
        throw new AlreadyInRoomException(existingRoomId);
    }

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;
        public AlreadyInRoomException(String roomId) {
            super("Already in room: " + roomId);
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
