package com.dobakggun.service;

import com.dobakggun.dto.battle.*;
import com.dobakggun.entity.battle.BattleRoom;
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
    private static final int RESULT_DISPLAY_SECONDS = 10;
    private static final int RECONNECT_GRACE_SECONDS = 15;
    private static final String TOPIC_PREFIX = "/topic/blockfall-battle/room/";
    private static final int MAX_PLAYERS = 5;

    // ─── 카운트다운 Future 저장 ───────────────────────────────────────────────
    private final ConcurrentHashMap<String, ScheduledFuture<?>> countdownFutures = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ScheduledFuture<?>> nextRoundFutures = new ConcurrentHashMap<>();

    // ─── 의존성 ───────────────────────────────────────────────────────────────
    private final BattleRoomManager roomManager;
    private final BattleRoomRepository battleRoomRepository;
    private final BattleRankingService rankingService;
    private final ThreadPoolTaskScheduler taskScheduler;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public BattleRoomService(
            BattleRoomManager roomManager,
            BattleRoomRepository battleRoomRepository,
            BattleRankingService rankingService,
            @Qualifier("battleTaskScheduler") ThreadPoolTaskScheduler taskScheduler) {
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

        // EC-8: 이미 활성 방에 참가 중인지 확인
        Optional<String> existingRoom = roomManager.findActiveRoomByPlayerId(playerId);
        if (existingRoom.isPresent()) {
            String existingRoomId = existingRoom.get();
            Optional<BattleRoomManager.PlayerSessionInfo> stale =
                    roomManager.findActivePlayer(existingRoomId, playerId);
            // sessionId == null: REST join 후 WS 연결 미완료(stale) → 제거 후 재진입 허용
            if (stale.isPresent() && stale.get().getSessionId() == null) {
                roomManager.removePlayerById(existingRoomId, playerId);
                log.info("joinBattle: stale(sessionless) entry evicted roomId={} playerId={}", existingRoomId, playerId);
            } else {
                throw new AlreadyInRoomException(existingRoomId);
            }
        }

        BattleRoomManager.PlayerSessionInfo player = new BattleRoomManager.PlayerSessionInfo(
                playerId, nickname, isGuest, null, isGuest ? null : userId);

        // 1. WAITING 방 + 정원 미달 탐색
        Optional<BattleRoom> waitingRoom = battleRoomRepository.findFirstByStatus(
                "WAITING", Sort.by(Sort.Direction.ASC, "createdAt"));

        if (waitingRoom.isPresent()) {
            BattleRoom room = waitingRoom.get();
            boolean joined = roomManager.joinRoom(room.getRoomId(), player);
            if (joined) {
                int playerCount = roomManager.getActivePlayers(room.getRoomId()).size();
                room.setCurrentPlayers(playerCount);
                battleRoomRepository.save(room);

                broadcastRoomState(room.getRoomId());
                tryStartCountdown(room.getRoomId());

                return BattleJoinResponse.builder()
                        .roomId(room.getRoomId())
                        .status("WAITING")
                        .playerCount(playerCount)
                        .maxPlayers(MAX_PLAYERS)
                        .queuePosition(null)
                        .isGuest(isGuest)
                        .guestToken(isGuest ? guestId : null)
                        .playerId(playerId)
                        .build();
            }
            // WAITING 방이 인메모리에서 꽉 찬 경우 → 해당 방 큐에 진입
            int queuePos = roomManager.getQueueSize(room.getRoomId());
            room.setQueueCount(queuePos);
            battleRoomRepository.save(room);
            broadcastRoomState(room.getRoomId());

            return BattleJoinResponse.builder()
                    .roomId(room.getRoomId())
                    .status("WAITING")
                    .playerCount(roomManager.getActivePlayers(room.getRoomId()).size())
                    .maxPlayers(MAX_PLAYERS)
                    .queuePosition(queuePos)
                    .isGuest(isGuest)
                    .guestToken(isGuest ? guestId : null)
                    .playerId(playerId)
                    .build();
        }

        // 2. PLAYING 방의 큐에 진입
        Optional<BattleRoom> playingRoom = battleRoomRepository.findFirstByStatus(
                "PLAYING", Sort.by(Sort.Direction.ASC, "createdAt"));

        if (playingRoom.isPresent()) {
            BattleRoom room = playingRoom.get();
            roomManager.joinRoom(room.getRoomId(), player);  // 큐 진입
            int queueSize = roomManager.getQueueSize(room.getRoomId());
            room.setQueueCount(queueSize);
            battleRoomRepository.save(room);

            broadcastRoomState(room.getRoomId());

            return BattleJoinResponse.builder()
                    .roomId(room.getRoomId())
                    .status("PLAYING")
                    .playerCount(roomManager.getActivePlayers(room.getRoomId()).size())
                    .maxPlayers(MAX_PLAYERS)
                    .queuePosition(queueSize)
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
        if (msg.getBoard() == null) {
            sendError(senderPlayerId, "INVALID_BOARD", "board 형식이 올바르지 않습니다.");
            return;
        }

        // BUG-COMM-02 수정: PlayerSessionInfo.score 갱신 (handlePlayerFinished 에서 사용)
        List<BattleRoomManager.PlayerSessionInfo> activePlayers = roomManager.getActivePlayers(roomId);
        activePlayers.stream()
                .filter(p -> p.getPlayerId().equals(senderPlayerId))
                .findFirst()
                .ifPresent(p -> p.setScore(msg.getScore()));

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

        final String capturedRoomId = roomId;
        taskScheduler.schedule(() -> {
            // old sessionId가 여전히 map에 있으면 재연결 안 한 것 → 실제 제거
            BattleRoomManager.PlayerSessionInfo player = roomManager.removePlayer(sessionId);
            if (player == null) return; // 재연결 성공 → sessionId 이미 갱신됨 → 무시
            handleLeaveInternal(capturedRoomId, player);
        }, Instant.now().plusSeconds(RECONNECT_GRACE_SECONDS));
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

        // BUG-004 수정: 자발적 이탈 플래그 설정 → finishGame 전적 저장 제외
        player.setVoluntaryLeft(true);

        // 카운트다운 중이라면 취소 검토
        cancelCountdownIfNeeded(roomId);

        // 게임 중 이탈이면 PLAYER_FINISHED 처리 (removePlayer 이후이므로 현재 alive 수 + 1 = rank)
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
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

        // 방 상태 갱신
        updateRoomDB(roomId);
        broadcastRoomState(roomId);

        // 살아있는 플레이어가 1명 남으면 자동 우승 처리
        checkAutoWin(roomId);
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
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        int count = players.size();

        if (count < 2) return;

        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null || !"WAITING".equals(room.getStatus())) return;

        if (count >= MAX_PLAYERS) {
            // 즉시 시작 (이미 카운트다운 중이면 취소 후 즉시)
            ScheduledFuture<?> existing = countdownFutures.remove(roomId);
            if (existing != null) existing.cancel(false);
            broadcast(roomId, "MATCH_COUNTDOWN", MatchCountdownPayload.builder().secondsRemaining(0).build());
            startGame(roomId);
            return;
        }

        // BUG-006 수정: putIfAbsent 원자적 등록 먼저 수행, 성공한 경우에만 브로드캐스트.
        // 브로드캐스트가 등록 전에 실행되면 동시 진입 시 MATCH_COUNTDOWN 중복 수신 가능.
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> startGame(roomId),
                Instant.now().plusSeconds(COUNTDOWN_SECONDS));
        ScheduledFuture<?> prev = countdownFutures.putIfAbsent(roomId, future);
        if (prev != null) {
            // 이미 다른 Future 가 등록되어 있음 — 새로 만든 것 취소, 브로드캐스트 없음
            future.cancel(false);
            return;
        }
        // 원자적 등록 성공 후 브로드캐스트 (1회만 발생 보장)
        broadcast(roomId, "MATCH_COUNTDOWN", MatchCountdownPayload.builder().secondsRemaining(COUNTDOWN_SECONDS).build());
        log.debug("BattleRoomService.tryStartCountdown: roomId={} seconds={}", roomId, COUNTDOWN_SECONDS);
    }

    private void cancelCountdownIfNeeded(String roomId) {
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        if (players.size() < 2) {
            ScheduledFuture<?> future = countdownFutures.remove(roomId);
            if (future != null && !future.isDone()) {
                future.cancel(false);
                broadcast(roomId, "MATCH_COUNTDOWN_CANCELLED", MatchCountdownPayload.builder().secondsRemaining(0).build());
                log.debug("BattleRoomService.cancelCountdown: roomId={}", roomId);
            }
        }
    }

    // ─── 게임 시작/종료 ───────────────────────────────────────────────────────

    @Transactional
    public void startGame(String roomId) {
        countdownFutures.remove(roomId);
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null) return;

        // WAITING 상태에서만 시작
        if (!"WAITING".equals(room.getStatus())) return;

        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        if (players.size() < 2) return;

        room.setStatus("PLAYING");
        room.setStartedAt(LocalDateTime.now());
        room.setCurrentPlayers(players.size());
        battleRoomRepository.save(room);

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

        room.setStatus("FINISHED");
        room.setFinishedAt(LocalDateTime.now());
        battleRoomRepository.save(room);

        // 전적 업데이트 (로그인 유저만, BUG-004: 자발적 이탈자 제외)
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

        // GAME_RESULT 브로드캐스트
        List<BattleRankingResponse.RankingEntry> topRankings = rankingService.getTopRankings();

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

        // 10초 후 다음 라운드 준비
        ScheduledFuture<?> nextRoundFuture = taskScheduler.schedule(
                () -> prepareNextRound(roomId),
                Instant.now().plusSeconds(RESULT_DISPLAY_SECONDS));
        nextRoundFutures.put(roomId, nextRoundFuture);
    }

    /**
     * FINISHED → WAITING 전이 + 큐 승격.
     * PRD §5.2
     */
    @Transactional
    public void prepareNextRound(String roomId) {
        nextRoundFutures.remove(roomId);
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        if (room == null) return;

        // 큐에서 최대 4명 승격 (기존 참가자 + 큐 대기자)
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

    // ─── 브로드캐스트 헬퍼 ───────────────────────────────────────────────────

    private void broadcast(String roomId, String type, Object payload) {
        BattleEnvelope envelope = buildEnvelope(type, payload);
        messagingTemplate.convertAndSend(TOPIC_PREFIX + roomId, envelope);
    }

    private void broadcastRoomState(String roomId) {
        List<BattleRoomManager.PlayerSessionInfo> players = roomManager.getActivePlayers(roomId);
        BattleRoom room = battleRoomRepository.findByRoomId(roomId).orElse(null);
        String status = room != null ? room.getStatus() : "WAITING";

        List<PlayerInfo> playerInfos = players.stream()
                .map(p -> PlayerInfo.builder()
                        .id(p.getPlayerId())
                        .nickname(p.getNickname())
                        .isGuest(p.isGuest())
                        .build())
                .toList();

        RoomStatePayload payload = RoomStatePayload.builder()
                .roomId(roomId)
                .status(status)
                .players(playerInfos)
                .queueCount(roomManager.getQueueSize(roomId))
                .build();

        broadcast(roomId, "ROOM_STATE", payload);
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
            BattleRoomManager.PlayerSessionInfo p = queue.get(i);
            QueuePositionPayload qp = QueuePositionPayload.builder()
                    .position(i + 1)
                    .totalInQueue(total)
                    .build();
            BattleEnvelope envelope = buildEnvelope("QUEUE_POSITION", qp);
            messagingTemplate.convertAndSendToUser(p.getPlayerId(), "/queue/blockfall-battle/queue", envelope);
        }
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

    // ─── 예외 ────────────────────────────────────────────────────────────────

    public static class AlreadyInRoomException extends RuntimeException {
        private final String roomId;
        public AlreadyInRoomException(String roomId) {
            super("Already in room: " + roomId);
            this.roomId = roomId;
        }
        public String getRoomId() { return roomId; }
    }
}
