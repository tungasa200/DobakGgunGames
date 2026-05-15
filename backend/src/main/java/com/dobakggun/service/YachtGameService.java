package com.dobakggun.service;

import com.dobakggun.dto.yacht.*;
import com.dobakggun.entity.yacht.*;
import com.dobakggun.repository.*;
import com.dobakggun.service.yacht.YachtScoreRules;
import com.dobakggun.service.yacht.YachtScoreRulesFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PreDestroy;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Yacht 게임 인메모리 상태 관리 및 핵심 게임 로직.
 *
 * CP1 확정 사항:
 *  - CP1-1: 턴 타임아웃 없음
 *  - CP1-2: yacht_win 테이블 upsert (GAME_OVER 시 1위 win_count++)
 *  - CP1-3: /ready (준비 토글) + /start (방장 전용 시작)
 */
@Slf4j
@Service
public class YachtGameService {

    // ─── 상수 ────────────────────────────────────────────────────────────────

    private static final String TOPIC_PREFIX = "/topic/yacht/room/";
    private static final int    ROOM_TTL_MINUTES = 10;

    /** 새로고침/연결 끊김 시 턴 양도까지의 유예 시간 (초) */
    private static final int RECONNECT_GRACE_SECONDS = 10;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    /** 유예 기간 중인 턴 양도 예약: "roomId:userId" → Future */
    private final ConcurrentHashMap<String, ScheduledFuture<?>> pendingTurnAdvances = new ConcurrentHashMap<>();

    @PreDestroy
    public void shutdownScheduler() {
        scheduler.shutdown();
    }

    // ─── 인메모리 상태 ────────────────────────────────────────────────────────

    /**
     * 방 인메모리 상태 (게임 진행 중 실시간 정보).
     */
    public static class YachtRoomState {
        public final String roomId;
        public volatile Long hostUserId;
        public volatile int maxPlayers;
        public volatile YachtRoomStatus status = YachtRoomStatus.WAITING;
        /** D6 / D8 모드. DB에서 복사. */
        public volatile YachtDiceType diceType = YachtDiceType.D6;

        /** 입장 순서대로 유지 */
        public final List<YachtPlayer> participants = new CopyOnWriteArrayList<>();
        /** 준비 완료 userId set */
        public final Set<Long> readySet = ConcurrentHashMap.newKeySet();

        // --- PLAYING 상태 전용 필드 ---
        /** 랜덤 셔플된 턴 순서 (고정) */
        public volatile List<Long> turnOrder = new ArrayList<>();
        /** turnOrder 내 현재 인덱스 */
        public volatile int turnOrderIndex = 0;
        /** 0-based 라운드 인덱스 (0~11) */
        public volatile int roundIndex = 0;

        /** 현재 주사위 상태 (0=미굴림) */
        public volatile int[] dice = new int[]{0, 0, 0, 0, 0};
        public volatile List<Integer> keptIndices = new ArrayList<>();
        public volatile int rollsLeft = 3;
        /** 이번 턴에 최소 1회 굴렸는지 */
        public volatile boolean hasRolled = false;

        /** 인게임 점수 Map: userId → (scoreKey → score). thread-safe. */
        public final Map<Long, Map<String, Integer>> scoreMap = new ConcurrentHashMap<>();

        /** 끊긴 유저 set (게임 중 자동 0점 기록 후 남겨둠) */
        public final Set<Long> disconnectedPlayers = ConcurrentHashMap.newKeySet();

        /** 재접속 대기 중인 플레이어 (투표 강퇴 전까지 무한 대기) */
        public final Set<Long> reconnectingPlayers = ConcurrentHashMap.newKeySet();
        /** 퇴출 투표: targetUserId → Set<voterUserId> */
        public final Map<Long, Set<Long>> kickVotes = new ConcurrentHashMap<>();
        /** 현재 활성 WebSocket 세션 ID: userId → sessionId */
        public final Map<Long, String> activeSessionIds = new ConcurrentHashMap<>();

        public YachtRoomState(String roomId, Long hostUserId, int maxPlayers, YachtDiceType diceType) {
            this.roomId     = roomId;
            this.hostUserId = hostUserId;
            this.maxPlayers = maxPlayers;
            this.diceType   = diceType;
        }
    }

    public static class YachtPlayer {
        public final Long   userId;
        public final String nickname;

        public YachtPlayer(Long userId, String nickname) {
            this.userId   = userId;
            this.nickname = nickname;
        }
    }

    private final ConcurrentHashMap<String, YachtRoomState> rooms = new ConcurrentHashMap<>();

    // ─── 의존성 ───────────────────────────────────────────────────────────────

    private final YachtRoomRepository        yachtRoomRepository;
    private final YachtParticipantRepository yachtParticipantRepository;
    private final YachtScoreRepository       yachtScoreRepository;
    private final YachtRankingService        yachtRankingService;
    private final UserRepository             userRepository;
    private final SecureRandom               rng = new SecureRandom();

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Lazy
    @Autowired
    private YachtBotService yachtBotService;

    public YachtGameService(
            YachtRoomRepository yachtRoomRepository,
            YachtParticipantRepository yachtParticipantRepository,
            YachtScoreRepository yachtScoreRepository,
            YachtRankingService yachtRankingService,
            UserRepository userRepository) {
        this.yachtRoomRepository        = yachtRoomRepository;
        this.yachtParticipantRepository = yachtParticipantRepository;
        this.yachtScoreRepository       = yachtScoreRepository;
        this.yachtRankingService        = yachtRankingService;
        this.userRepository             = userRepository;
    }

    // ─── 서버 재시작 처리 ─────────────────────────────────────────────────────

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void closeStaleRoomsOnStartup() {
        List<YachtRoomStatus> active = List.of(YachtRoomStatus.WAITING, YachtRoomStatus.PLAYING);
        int closed = yachtRoomRepository.closeAllActiveRooms(
                YachtRoomStatus.FINISHED,
                LocalDateTime.now(ZoneOffset.UTC),
                active);
        if (closed > 0) {
            log.info("YachtGameService: 서버 재시작 — 좀비 방 {}개 FINISHED 처리", closed);
        }
    }

    // ─── JOIN ────────────────────────────────────────────────────────────────

    /**
     * /join 처리: WS 세션-방 바인딩 + ROOM_STATE 브로드캐스트.
     * DB participant는 YachtMatchService에서 이미 생성.
     *
     * @return null=성공, otherwise=에러코드
     */
    public String joinRoom(String roomId, Long userId, String nickname) {
        YachtRoomState state = getOrCreateState(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        boolean asSpectator;
        boolean wasReconnecting;
        String returnedNickname;

        synchronized (state) {
            if (state.status == YachtRoomStatus.FINISHED) {
                log.warn("joinRoom: roomId={} FINISHED 상태 진입 거부", roomId);
                return "ROOM_NOT_AVAILABLE";
            }

            // 강퇴/영구 이탈된 플레이어는 재진입 불가
            if (state.disconnectedPlayers.contains(userId)) {
                log.warn("joinRoom: roomId={} 강퇴된 플레이어 {} 재진입 거부", roomId, userId);
                return "ROOM_NOT_AVAILABLE";
            }

            asSpectator = (state.status == YachtRoomStatus.PLAYING)
                    && !state.reconnectingPlayers.contains(userId)
                    && !state.turnOrder.contains(userId);

            boolean alreadyIn = state.participants.stream().anyMatch(p -> p.userId.equals(userId));
            if (!alreadyIn) {
                state.participants.add(new YachtPlayer(userId, nickname));
                // 관전자도 scoreMap entry는 빈 상태로 둠 (점수 없음 — turnOrder에 없으므로 채워질 일 없음)
                state.scoreMap.putIfAbsent(userId, new ConcurrentHashMap<>());
                log.info("joinRoom: userId={} 방 {} 입장 (현재 {}명, spectator={})",
                        userId, roomId, state.participants.size(), asSpectator);
            }

            // 재접속 대기 중인 플레이어가 돌아온 경우
            wasReconnecting = state.reconnectingPlayers.contains(userId);
            if (wasReconnecting) {
                state.reconnectingPlayers.remove(userId);
                state.kickVotes.remove(userId);
            }
            returnedNickname = nickname;
        }

        // 재접속 복귀 브로드캐스트
        if (wasReconnecting) {
            // 유예 기간 타이머 취소 (플레이어가 제 시간에 돌아옴)
            String advanceKey = roomId + ":" + userId;
            ScheduledFuture<?> pending = pendingTurnAdvances.remove(advanceKey);
            if (pending != null) pending.cancel(false);

            broadcast(roomId, "PLAYER_RETURNED", YachtPlayerReturnedPayload.builder()
                    .userId(userId)
                    .nickname(returnedNickname)
                    .build());
            log.info("joinRoom: 재접속 복귀 userId={} roomId={}", userId, roomId);
        }

        broadcastRoomState(state);

        // 관전자 또는 재접속 플레이어: 현재 게임 상태 캐치업 — TURN_STATE 재방송
        // (모두에게 가지만 기존 플레이어는 같은 값을 다시 받을 뿐 무해)
        if (asSpectator || wasReconnecting) {
            broadcastTurnState(state);
        }
        return null;
    }

    /**
     * 인메모리 상태 초기화 (없으면 DB에서 방 정보 조회).
     */
    private YachtRoomState getOrCreateState(String roomId) {
        YachtRoomState existing = rooms.get(roomId);
        if (existing != null) return existing;

        YachtRoom dbRoom = yachtRoomRepository.findByRoomId(roomId).orElse(null);
        if (dbRoom == null) return null;
        if (dbRoom.getStatus() == YachtRoomStatus.FINISHED) return null;

        YachtDiceType dt = dbRoom.getDiceType() != null ? dbRoom.getDiceType() : YachtDiceType.D6;
        YachtRoomState newState = new YachtRoomState(roomId, dbRoom.getHostUserId(), dbRoom.getMaxPlayers(), dt);
        newState.status = dbRoom.getStatus();

        // DB에서 기존 참가자 복원 (재시작 대응)
        List<YachtParticipant> dbParticipants = yachtParticipantRepository
                .findActiveParticipants(dbRoom);
        for (YachtParticipant p : dbParticipants) {
            String nick = userRepository.findById(p.getUserId())
                    .map(u -> u.getNickname()).orElse("Unknown");
            newState.participants.add(new YachtPlayer(p.getUserId(), nick));
            newState.scoreMap.put(p.getUserId(), new ConcurrentHashMap<>());
            if (p.isReady()) newState.readySet.add(p.getUserId());
        }

        return rooms.computeIfAbsent(roomId, id -> newState);
    }

    // ─── READY ────────────────────────────────────────────────────────────────

    /**
     * /ready 처리: 준비/준비취소 토글 (비방장).
     */
    public String setReady(String roomId, Long userId, boolean ready) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        synchronized (state) {
            if (state.status != YachtRoomStatus.WAITING) return "GAME_NOT_ACTIVE";

            boolean isParticipant = state.participants.stream().anyMatch(p -> p.userId.equals(userId));
            if (!isParticipant) return "NOT_IN_ROOM";

            if (userId.equals(state.hostUserId)) return "NOT_HOST"; // 방장은 /ready 불필요
        }

        if (ready) {
            state.readySet.add(userId);
        } else {
            state.readySet.remove(userId);
        }

        broadcastRoomState(state);
        log.info("setReady: roomId={} userId={} ready={}", roomId, userId, ready);
        return null;
    }

    // ─── START ────────────────────────────────────────────────────────────────

    /**
     * /start 처리: 방장이 게임 시작 (전원 준비 완료 필요).
     */
    public String startGame(String roomId, Long userId) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        List<YachtPlayer> snapshot;
        synchronized (state) {
            if (!userId.equals(state.hostUserId)) return "NOT_HOST";
            if (state.status != YachtRoomStatus.WAITING) return "GAME_NOT_ACTIVE";

            int count = state.participants.size();
            if (count < 2) return "NOT_ENOUGH_PLAYERS";

            // 비방장 전원 준비 확인
            boolean allReady = state.participants.stream()
                    .filter(p -> !p.userId.equals(state.hostUserId))
                    .allMatch(p -> state.readySet.contains(p.userId));
            if (!allReady) return "NOT_ALL_READY";

            // 게임 시작
            state.status = YachtRoomStatus.PLAYING;

            // 턴 순서 랜덤 셔플
            List<Long> userIds = state.participants.stream()
                    .map(p -> p.userId)
                    .collect(Collectors.toCollection(ArrayList::new));
            Collections.shuffle(userIds, rng);
            state.turnOrder = userIds;
            state.turnOrderIndex = 0;
            state.roundIndex = 0;
            state.dice = new int[]{0, 0, 0, 0, 0};
            state.keptIndices = new ArrayList<>();
            state.rollsLeft = YachtScoreRulesFactory.get(state.diceType).maxRollsPerTurn();
            state.hasRolled = false;

            snapshot = new ArrayList<>(state.participants);
        }

        // DB 업데이트
        updateDbStatusPlaying(roomId);

        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
        int totalRounds = snapshot.size() * rules.totalScoreKeys();
        Long firstTurnUserId = state.turnOrder.get(0);

        broadcast(roomId, "GAME_STARTED", YachtGameStartedPayload.builder()
                .roomId(roomId)
                .diceType(state.diceType.name())
                .turnOrder(state.turnOrder)
                .currentTurnUserId(firstTurnUserId)
                .rollsLeft(rules.maxRollsPerTurn())
                .totalRounds(totalRounds)
                .build());

        broadcastTurnState(state);

        // 첫 턴이 봇이면 봇 액션 트리거
        if (yachtBotService != null && yachtBotService.isBot(firstTurnUserId)) {
            yachtBotService.onBotTurnStarted(roomId);
        }

        log.info("startGame: roomId={} 게임 시작. turnOrder={}", roomId, state.turnOrder);
        return null;
    }

    // ─── ROLL ────────────────────────────────────────────────────────────────

    /**
     * /roll 처리: 서버 SecureRandom으로 주사위 생성.
     * 클라이언트 dice 필드는 무시, keptIndices만 신뢰.
     */
    public String rollDice(String roomId, Long userId, List<Integer> keptIndices) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        int[] newDice;
        List<Integer> validKept;
        int rollsLeft;

        synchronized (state) {
            if (state.status != YachtRoomStatus.PLAYING) return "GAME_NOT_ACTIVE";

            Long currentUserId = currentTurnUserId(state);
            if (!userId.equals(currentUserId)) return "NOT_YOUR_TURN";

            if (state.rollsLeft <= 0) return "ALREADY_ROLLED_MAX";

            // keptIndices 유효성 검증
            if (keptIndices == null) keptIndices = new ArrayList<>();
            validKept = validateKeptIndices(keptIndices, !state.hasRolled);
            if (validKept == null) return "INVALID_KEPT_INDICES";

            // 첫 굴림이면 keptIndices 무시 (전부 새로 굴림)
            if (!state.hasRolled) {
                validKept = new ArrayList<>();
            }

            // 서버 주사위 생성 (keep 안 된 인덱스만 새로 굴림) — 룰셋에서 면 수 가져옴
            YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
            newDice = Arrays.copyOf(state.dice, 5);
            for (int i = 0; i < 5; i++) {
                if (!validKept.contains(i)) {
                    newDice[i] = rng.nextInt(rules.rngFaces()) + 1;
                }
            }

            state.dice = newDice;
            state.keptIndices = new ArrayList<>(validKept);
            state.rollsLeft--;
            state.hasRolled = true;
            rollsLeft = state.rollsLeft;
        }

        broadcast(roomId, "ROLL_RESULT", YachtRollResultPayload.builder()
                .currentTurnUserId(userId)
                .dice(newDice)
                .keptIndices(new ArrayList<>(validKept))
                .rollsLeft(rollsLeft)
                .build());

        log.info("rollDice: roomId={} userId={} dice={} rollsLeft={}", roomId, userId, Arrays.toString(newDice), rollsLeft);
        return null;
    }

    /**
     * keptIndices 유효성 검증.
     * - 0~4 범위
     * - 중복 없음
     * - 첫 굴림(isFirst=true)이면 빈 배열만 허용
     * @return 유효하면 정제된 list, 무효이면 null
     */
    private List<Integer> validateKeptIndices(List<Integer> indices, boolean isFirst) {
        if (isFirst) {
            // 첫 굴림에서 keptIndices가 있으면 무시(빈 배열로 처리)
            return new ArrayList<>();
        }
        Set<Integer> seen = new HashSet<>();
        for (Integer idx : indices) {
            if (idx == null || idx < 0 || idx > 4) return null;
            if (!seen.add(idx)) return null; // 중복
        }
        return new ArrayList<>(indices);
    }

    // ─── SCORE ────────────────────────────────────────────────────────────────

    /**
     * /score 처리: 족보 선택 + 점수 계산 + SCORE_RECORDED + TURN_CHANGED or GAME_OVER.
     */
    @Transactional
    public String recordScore(String roomId, Long userId, String scoreKey) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        int[] diceSnapshot;
        int scoreValue;
        Long previousTurnUserId;
        Long nextTurnUserId;
        int newRoundIndex;
        boolean gameOver;
        List<YachtPlayer> participantsSnapshot;

        int rollsForNextTurn;
        synchronized (state) {
            if (state.status != YachtRoomStatus.PLAYING) return "GAME_NOT_ACTIVE";

            Long currentUserId = currentTurnUserId(state);
            if (!userId.equals(currentUserId)) return "NOT_YOUR_TURN";

            if (!state.hasRolled) return "MUST_ROLL_FIRST";

            YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
            if (!rules.validScoreKeys().contains(scoreKey)) return "INVALID_SCORE_KEY";
            rollsForNextTurn = rules.maxRollsPerTurn();

            Map<String, Integer> userScores = state.scoreMap.get(userId);
            if (userScores == null) {
                userScores = new ConcurrentHashMap<>();
                state.scoreMap.put(userId, userScores);
            }
            if (userScores.containsKey(scoreKey)) return "ALREADY_SCORED";

            diceSnapshot = Arrays.copyOf(state.dice, 5);
            scoreValue = rules.calculateScore(scoreKey, diceSnapshot);
            userScores.put(scoreKey, scoreValue);

            previousTurnUserId = userId;

            // 다음 턴 계산
            state.turnOrderIndex = (state.turnOrderIndex + 1) % state.turnOrder.size();
            if (state.turnOrderIndex == 0) {
                state.roundIndex++; // 새 라운드
            }

            // 재접속 대기 플레이어 턴 스킵
            skipReconnectingTurns(state);

            newRoundIndex = state.roundIndex;

            // 턴 상태 리셋
            state.dice = new int[]{0, 0, 0, 0, 0};
            state.keptIndices = new ArrayList<>();
            state.rollsLeft = rollsForNextTurn;
            state.hasRolled = false;

            nextTurnUserId = currentTurnUserId(state);
            participantsSnapshot = new ArrayList<>(state.participants);

            // 게임 종료 여부: 모든 유저가 12개 채웠는지
            gameOver = isGameOver(state);
        }

        // 점수 계산 (상단 보너스 포함)
        Map<String, Integer> userScores = state.scoreMap.get(userId);
        YachtScoreRules rulesForBonus = YachtScoreRulesFactory.get(state.diceType);
        int upperTotal = computeUpperTotal(userScores, rulesForBonus);
        boolean bonusEarned = isBonusJustEarned(userScores, scoreKey, rulesForBonus);
        int grandTotal = computeGrandTotal(userScores, upperTotal, isBonusEarned(userScores, rulesForBonus), rulesForBonus);

        // DB 저장
        saveScoreToDB(roomId, userId, scoreKey, scoreValue);

        // SCORE_RECORDED 브로드캐스트
        broadcast(roomId, "SCORE_RECORDED", YachtScoreRecordedPayload.builder()
                .userId(userId)
                .scoreKey(scoreKey)
                .score(scoreValue)
                .upperTotal(upperTotal)
                .bonusEarned(bonusEarned)
                .grandTotal(grandTotal)
                .build());

        if (gameOver) {
            finishGame(roomId, state, participantsSnapshot);
        } else {
            // TURN_CHANGED
            broadcast(roomId, "TURN_CHANGED", YachtTurnChangedPayload.builder()
                    .previousTurnUserId(previousTurnUserId)
                    .currentTurnUserId(nextTurnUserId)
                    .rollsLeft(rollsForNextTurn)
                    .roundNum(newRoundIndex + 1)
                    .build());

            broadcastTurnState(state);

            // 다음 턴이 봇이면 봇 액션 트리거
            if (yachtBotService != null && yachtBotService.isBot(nextTurnUserId)) {
                yachtBotService.onBotTurnStarted(roomId);
            }
        }

        log.info("recordScore: roomId={} userId={} scoreKey={} score={}", roomId, userId, scoreKey, scoreValue);
        return null;
    }

    // ─── LEAVE ────────────────────────────────────────────────────────────────

    /**
     * /leave 또는 SessionDisconnectEvent 처리.
     */
    @Transactional
    public void leaveRoom(String roomId, Long userId, String reason) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return;

        String nickname;
        boolean wasHost;
        boolean wasCurrentTurn = false;
        boolean isPlaying;
        boolean wasSpectator;
        int remaining;

        synchronized (state) {
            YachtPlayer leaving = state.participants.stream()
                    .filter(p -> p.userId.equals(userId))
                    .findFirst()
                    .orElse(null);
            if (leaving == null) return;

            nickname = leaving.nickname;
            wasHost = userId.equals(state.hostUserId);
            isPlaying = (state.status == YachtRoomStatus.PLAYING);
            wasSpectator = isSpectator(state, userId);

            if (isPlaying) {
                wasCurrentTurn = userId.equals(currentTurnUserId(state));
            }

            // 관전자: 게임 로직에 영향 없이 목록에서만 제거
            // 대기방: 목록에서 제거 + readySet 정리
            // 게임 중 플레이어: DISCONNECT → 유예 기간, LEAVE → 즉시 disconnectedPlayers
            if (wasSpectator) {
                state.participants.remove(leaving);
                state.scoreMap.remove(userId);
            } else if (!isPlaying) {
                state.participants.remove(leaving);
                state.readySet.remove(userId);
            } else {
                if ("DISCONNECT".equals(reason)) {
                    // 그레이스 기간: 아직 disconnectedPlayers에 추가하지 않음
                } else {
                    state.disconnectedPlayers.add(userId);
                }
            }

            // remaining: turnOrder 기준 활성 플레이어 수 (관전자, 끊긴 플레이어, 재접속 대기 제외)
            // 대기방: 전체 참가자 수
            if (isPlaying) {
                remaining = (int) state.turnOrder.stream()
                        .filter(uid -> !state.disconnectedPlayers.contains(uid))
                        .filter(uid -> !state.reconnectingPlayers.contains(uid))
                        .filter(uid -> !uid.equals(userId)) // 방금 끊긴 플레이어 제외
                        .count();
            } else {
                remaining = state.participants.size();
            }
        }

        // PLAYER_LEFT 브로드캐스트 (DISCONNECT + 게임 중은 유예 기간 시작이므로 아직 PLAYER_LEFT 미발송)
        if (!("DISCONNECT".equals(reason) && isPlaying && !wasSpectator)) {
            broadcast(roomId, "PLAYER_LEFT", YachtPlayerLeftPayload.builder()
                    .roomId(roomId)
                    .userId(userId)
                    .nickname(nickname)
                    .reason(reason)
                    .build());
        }

        // DB participant 퇴장 기록 (DISCONNECT 유예 중은 아직 기록 안 함)
        if (!("DISCONNECT".equals(reason) && isPlaying && !wasSpectator)) {
            markParticipantLeft(roomId, userId);
        }

        if (wasSpectator) {
            // 관전자 퇴장: 단순히 ROOM_STATE 재방송. 게임 진행에 영향 없음.
            broadcastRoomState(state);
            log.info("leaveRoom: 관전자 userId={} 방 {} 퇴장", userId, roomId);
            return;
        }

        if (!isPlaying) {
            handleWaitingLeave(state, wasHost, remaining, userId, nickname);
        } else if ("DISCONNECT".equals(reason) && remaining >= 1) {
            startReconnectWait(state, userId, wasCurrentTurn, nickname);
        } else if ("DISCONNECT".equals(reason) && remaining == 0) {
            // 혼자 남은 경우: 즉시 처리
            broadcast(roomId, "PLAYER_LEFT", YachtPlayerLeftPayload.builder()
                    .roomId(roomId).userId(userId).nickname(nickname).reason(reason).build());
            markParticipantLeft(roomId, userId);
            handlePlayingLeave(state, userId, wasCurrentTurn, 0);
        } else {
            handlePlayingLeave(state, userId, wasCurrentTurn, remaining);
        }
    }

    // ─── 재접속 대기 ──────────────────────────────────────────────────────────

    /**
     * 연결 끊김 처리: reconnectingPlayers에 등록하고 투표 강퇴 전까지 무한 대기.
     * 타이머 없음 — 다른 플레이어 과반수 투표로만 강퇴 가능.
     */
    private void startReconnectWait(YachtRoomState state, Long userId, boolean wasCurrentTurn, String nickname) {
        synchronized (state) {
            state.reconnectingPlayers.add(userId);
            // 현재 턴이어도 즉시 양도하지 않음 — RECONNECT_GRACE_SECONDS 후 스케줄러에서 처리
        }

        broadcastRoomState(state);
        broadcast(state.roomId, "PLAYER_RECONNECTING", YachtPlayerReconnectingPayload.builder()
                .userId(userId)
                .nickname(nickname)
                .build());

        log.info("startReconnectWait: roomId={} userId={} 재접속 대기 시작 ({}초 유예, 투표 강퇴 가능)",
                state.roomId, userId, RECONNECT_GRACE_SECONDS);

        if (wasCurrentTurn) {
            String advanceKey = state.roomId + ":" + userId;
            ScheduledFuture<?> future = scheduler.schedule(() -> {
                pendingTurnAdvances.remove(advanceKey);
                advanceTurnForReconnecting(state, userId);
            }, RECONNECT_GRACE_SECONDS, TimeUnit.SECONDS);
            pendingTurnAdvances.put(advanceKey, future);
        }

        // 다른 플레이어들이 모두 완료된 경우 즉시 게임 종료
        synchronized (state) {
            if (isGameOver(state)) {
                finishGame(state.roomId, state, new ArrayList<>(state.participants));
            }
        }
    }

    /**
     * 유예 기간 만료 시 또는 강퇴 처리 시 호출 — 끊긴 플레이어의 턴을 다음으로 넘김.
     */
    private void advanceTurnForReconnecting(YachtRoomState state, Long userId) {
        synchronized (state) {
            if (!state.reconnectingPlayers.contains(userId)) return; // 이미 재접속함

            int maxRolls = YachtScoreRulesFactory.get(state.diceType).maxRollsPerTurn();
            state.turnOrderIndex = (state.turnOrderIndex + 1) % state.turnOrder.size();
            if (state.turnOrderIndex == 0) state.roundIndex++;
            state.dice = new int[]{0, 0, 0, 0, 0};
            state.keptIndices = new ArrayList<>();
            state.rollsLeft = maxRolls;
            state.hasRolled = false;

            skipReconnectingTurns(state);
            Long nextTurn = currentTurnUserId(state);

            if (!isGameOver(state) && nextTurn != null) {
                broadcast(state.roomId, "TURN_CHANGED", YachtTurnChangedPayload.builder()
                        .previousTurnUserId(userId)
                        .currentTurnUserId(nextTurn)
                        .rollsLeft(maxRolls)
                        .roundNum(state.roundIndex + 1)
                        .build());
                broadcastTurnState(state);
                if (yachtBotService != null && yachtBotService.isBot(nextTurn)) {
                    yachtBotService.onBotTurnStarted(state.roomId);
                }
            } else if (isGameOver(state)) {
                finishGame(state.roomId, state, new ArrayList<>(state.participants));
            }
        }
        log.info("advanceTurnForReconnecting: roomId={} userId={} 유예 만료 → 턴 양도", state.roomId, userId);
    }

    /**
     * synchronized(state) 블록 내에서 호출.
     * reconnecting/disconnected 플레이어 또는 이미 모든 족보를 채운 플레이어의 턴을 연속으로 건너뜀.
     * 이미 완료된 플레이어 스킵은 reconnecting 플레이어 재접속 후 완료 플레이어로 턴이 고착되는 버그를 방지한다.
     */
    private void skipReconnectingTurns(YachtRoomState state) {
        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
        int totalKeys = rules.totalScoreKeys();
        int maxSkips = state.turnOrder.size();
        int skips = 0;
        while (skips < maxSkips) {
            Long next = currentTurnUserId(state);
            if (next == null) break;
            boolean isReconnecting = state.reconnectingPlayers.contains(next);
            boolean isDisconnected = state.disconnectedPlayers.contains(next);
            boolean isDone = state.scoreMap.getOrDefault(next, Collections.emptyMap()).size() >= totalKeys;
            if (!isReconnecting && !isDisconnected && !isDone) break;
            state.turnOrderIndex = (state.turnOrderIndex + 1) % state.turnOrder.size();
            if (state.turnOrderIndex == 0) state.roundIndex++;
            skips++;
        }
    }

    // ─── 투표 강퇴 ────────────────────────────────────────────────────────────

    public String voteKick(String roomId, Long voterId, Long targetUserId) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        boolean kicked;
        int voteCount;
        int requiredCount;
        String targetNickname;

        synchronized (state) {
            if (state.status != YachtRoomStatus.PLAYING) return "GAME_NOT_ACTIVE";
            if (!state.reconnectingPlayers.contains(targetUserId)) return "TARGET_NOT_RECONNECTING";

            boolean isActiveVoter = state.turnOrder.contains(voterId)
                    && !state.reconnectingPlayers.contains(voterId)
                    && !state.disconnectedPlayers.contains(voterId);
            if (!isActiveVoter) return "NOT_ACTIVE_PLAYER";

            state.kickVotes.computeIfAbsent(targetUserId, k -> ConcurrentHashMap.newKeySet()).add(voterId);

            long activePlayers = state.turnOrder.stream()
                    .filter(uid -> !state.reconnectingPlayers.contains(uid))
                    .filter(uid -> !state.disconnectedPlayers.contains(uid))
                    .count();

            voteCount = state.kickVotes.get(targetUserId).size();
            requiredCount = (int) Math.max(1, (activePlayers + 1) / 2);

            targetNickname = state.participants.stream()
                    .filter(p -> p.userId.equals(targetUserId))
                    .map(p -> p.nickname)
                    .findFirst()
                    .orElse("Unknown");

            kicked = voteCount >= requiredCount;
            if (kicked) {
                state.reconnectingPlayers.remove(targetUserId);
                state.disconnectedPlayers.add(targetUserId);
                state.kickVotes.remove(targetUserId);
            }
        }

        broadcast(roomId, "KICK_VOTE", YachtKickVotePayload.builder()
                .targetUserId(targetUserId)
                .targetNickname(targetNickname)
                .voteCount(voteCount)
                .requiredCount(requiredCount)
                .passed(kicked ? Boolean.TRUE : null)
                .build());

        if (kicked) {
            // 유예 기간 타이머가 있으면 취소 (advanceTurnForReconnecting 여기서 직접 처리)
            String advanceKey = roomId + ":" + targetUserId;
            ScheduledFuture<?> pending = pendingTurnAdvances.remove(advanceKey);
            if (pending != null) pending.cancel(false);

            broadcast(roomId, "PLAYER_LEFT", YachtPlayerLeftPayload.builder()
                    .roomId(roomId)
                    .userId(targetUserId)
                    .nickname(targetNickname)
                    .reason("KICK")
                    .build());
            markParticipantLeft(roomId, targetUserId);
            autoFillScores(state, targetUserId);
            broadcastRoomState(state);
            synchronized (state) {
                if (isGameOver(state)) {
                    finishGame(roomId, state, new ArrayList<>(state.participants));
                    return null;
                }
                // 강퇴된 플레이어가 현재 턴이었으면 다음으로 넘김
                Long current = currentTurnUserId(state);
                if (current != null && current.equals(targetUserId)) {
                    int maxRolls = YachtScoreRulesFactory.get(state.diceType).maxRollsPerTurn();
                    state.turnOrderIndex = (state.turnOrderIndex + 1) % state.turnOrder.size();
                    if (state.turnOrderIndex == 0) state.roundIndex++;
                    state.dice = new int[]{0, 0, 0, 0, 0};
                    state.keptIndices = new ArrayList<>();
                    state.rollsLeft = maxRolls;
                    state.hasRolled = false;
                    skipReconnectingTurns(state);
                    Long nextTurn = currentTurnUserId(state);
                    if (nextTurn != null) {
                        broadcast(roomId, "TURN_CHANGED", YachtTurnChangedPayload.builder()
                                .previousTurnUserId(targetUserId)
                                .currentTurnUserId(nextTurn)
                                .rollsLeft(maxRolls)
                                .roundNum(state.roundIndex + 1)
                                .build());
                        broadcastTurnState(state);
                    }
                }
            }
        }

        return null;
    }

    // ─── 세션 추적 ────────────────────────────────────────────────────────────

    public void registerSession(String roomId, Long userId, String sessionId) {
        YachtRoomState state = rooms.get(roomId);
        if (state != null && sessionId != null) {
            state.activeSessionIds.put(userId, sessionId);
        }
    }

    public boolean isActiveSession(String roomId, Long userId, String sessionId) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return true;
        String current = state.activeSessionIds.get(userId);
        return current == null || current.equals(sessionId);
    }

    private void handleWaitingLeave(YachtRoomState state, boolean wasHost, int remaining,
                                     Long userId, String nickname) {
        if (remaining == 0) {
            closeRoom(state, "EMPTY");
            return;
        }

        synchronized (state) {
            if (wasHost && !state.participants.isEmpty()) {
                YachtPlayer newHost = state.participants.get(0);
                state.hostUserId = newHost.userId;
                // 방 DB 업데이트
                updateDbHost(state.roomId, newHost.userId);
                log.info("handleWaitingLeave: 방장 이전 roomId={} newHost={}", state.roomId, newHost.userId);
            }
        }

        broadcastRoomState(state);
    }

    /**
     * 게임 중 퇴장/끊김 처리.
     * 끊긴 유저의 미기록 족보 전체 0점 자동 기록.
     */
    @Transactional
    void handlePlayingLeave(YachtRoomState state, Long userId, boolean wasCurrentTurn, int remaining) {
        // 잔존 1명(활성) → ROOM_CLOSED
        if (remaining <= 1) {
            // 남은 1명의 미기록 족보도 0점 처리 후 GAME_OVER 처리는 생략 (PRD §7.3)
            autoFillScores(state, userId);
            closeRoom(state, "INSUFFICIENT_PLAYERS");
            return;
        }

        // 미기록 족보 전체 0점 자동 기록
        autoFillScores(state, userId);

        broadcastRoomState(state);

        // 현재 턴이었다면 다음 턴으로
        if (wasCurrentTurn) {
            synchronized (state) {
                int maxRolls = YachtScoreRulesFactory.get(state.diceType).maxRollsPerTurn();
                Long prevTurn = userId;
                state.turnOrderIndex = (state.turnOrderIndex + 1) % state.turnOrder.size();
                if (state.turnOrderIndex == 0) state.roundIndex++;

                state.dice = new int[]{0, 0, 0, 0, 0};
                state.keptIndices = new ArrayList<>();
                state.rollsLeft = maxRolls;
                state.hasRolled = false;

                Long nextTurn = currentTurnUserId(state);

                // 게임 종료 여부 확인
                if (isGameOver(state)) {
                    finishGame(state.roomId, state, new ArrayList<>(state.participants));
                    return;
                }

                broadcast(state.roomId, "TURN_CHANGED", YachtTurnChangedPayload.builder()
                        .previousTurnUserId(prevTurn)
                        .currentTurnUserId(nextTurn)
                        .rollsLeft(maxRolls)
                        .roundNum(state.roundIndex + 1)
                        .build());

                broadcastTurnState(state);
            }
        } else {
            // 비활성 플레이어 끊김 — 게임 종료 여부만 확인
            synchronized (state) {
                if (isGameOver(state)) {
                    finishGame(state.roomId, state, new ArrayList<>(state.participants));
                }
            }
        }
    }

    /**
     * 끊긴 유저의 미기록 족보를 전부 0점으로 자동 기록.
     * 룰셋에서 validScoreKeys를 가져오므로 D6/D8 모두 정확하게 채워진다.
     */
    @Transactional
    void autoFillScores(YachtRoomState state, Long userId) {
        Map<String, Integer> userScores = state.scoreMap.computeIfAbsent(userId, k -> new ConcurrentHashMap<>());
        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);

        for (String key : rules.validScoreKeys()) {
            if (!userScores.containsKey(key)) {
                userScores.put(key, 0);
                saveScoreToDB(state.roomId, userId, key, 0);

                int upperTotal = computeUpperTotal(userScores, rules);
                boolean bonusEarned = isBonusEarned(userScores, rules);
                int grandTotal = computeGrandTotal(userScores, upperTotal, bonusEarned, rules);

                broadcast(state.roomId, "SCORE_RECORDED", YachtScoreRecordedPayload.builder()
                        .userId(userId)
                        .scoreKey(key)
                        .score(0)
                        .upperTotal(upperTotal)
                        .bonusEarned(bonusEarned)
                        .grandTotal(grandTotal)
                        .build());
            }
        }
        log.info("autoFillScores: roomId={} userId={} 미기록 족보 0점 자동 기록", state.roomId, userId);
    }

    // ─── GAME OVER ────────────────────────────────────────────────────────────

    /**
     * 게임 종료 처리: 최종 점수 계산 → GAME_OVER → DB 업데이트 → yacht_win upsert.
     * 활성 참가자가 2명 이상이면 같은 방에서 재시작할 수 있도록 WAITING으로 리셋,
     * 미만이면 기존대로 방을 닫는다.
     */
    @Transactional
    void finishGame(String roomId, YachtRoomState state, List<YachtPlayer> participants) {
        synchronized (state) {
            if (state.status != YachtRoomStatus.PLAYING) return;
        }

        // 재접속 대기 중인 플레이어 즉시 0점 처리 (게임 종료)
        for (Long reconnectingId : new ArrayList<>(state.reconnectingPlayers)) {
            state.reconnectingPlayers.remove(reconnectingId);
            state.disconnectedPlayers.add(reconnectingId);
            state.kickVotes.remove(reconnectingId);
            autoFillScores(state, reconnectingId);
        }

        // 최종 점수 계산
        List<YachtRankingEntryDto> rankings = computeRankings(state, participants);
        List<Long> winnerIds = rankings.stream()
                .filter(YachtRankingEntryDto::isWinner)
                .map(YachtRankingEntryDto::getUserId)
                .collect(Collectors.toList());

        broadcast(roomId, "GAME_OVER", YachtGameOverPayload.builder()
                .roomId(roomId)
                .rankings(rankings)
                .winnerUserIds(winnerIds)
                .build());

        // 랭킹 전적 업데이트 — 봇이 포함된 방은 집계 제외
        boolean hasBotParticipant = yachtBotService != null &&
                rankings.stream().anyMatch(e -> yachtBotService.isBot(e.getUserId()));
        if (!hasBotParticipant) {
            for (YachtRankingEntryDto entry : rankings) {
                yachtRankingService.updateRecord(entry.getUserId(), entry.isWinner(), state.diceType);
            }
        }

        // 재시작 가능 여부: 끊기지 않은 in-memory 참가자가 2명 이상
        int activeParticipants;
        synchronized (state) {
            activeParticipants = (int) state.participants.stream()
                    .filter(p -> !state.disconnectedPlayers.contains(p.userId))
                    .filter(p -> !state.reconnectingPlayers.contains(p.userId))
                    .count();
        }

        if (activeParticipants >= 2) {
            resetForRestart(roomId, state);
            log.info("finishGame: roomId={} GAME_OVER winners={} → 재게임 대기 (WAITING)", roomId, winnerIds);
        } else {
            // DB도 FINISHED 처리 + 인메모리에서 제거
            updateDbFinished(roomId, winnerIds);
            rooms.remove(roomId);
            synchronized (state) {
                state.status = YachtRoomStatus.FINISHED;
            }
            log.info("finishGame: roomId={} GAME_OVER winners={} 종료 (활성 {}명 — 재시작 불가)",
                    roomId, winnerIds, activeParticipants);
        }
    }

    /**
     * 재게임을 위한 인메모리/DB 상태 리셋. 끊긴 유저는 참가자 목록에서 제거.
     * yacht_score 레코드는 새 게임 기록을 위해 일괄 삭제.
     */
    @Transactional
    void resetForRestart(String roomId, YachtRoomState state) {
        synchronized (state) {
            // 끊긴 유저 제거
            state.participants.removeIf(p -> state.disconnectedPlayers.contains(p.userId));
            state.disconnectedPlayers.clear();

            // 재접속 대기 상태 정리
            state.reconnectingPlayers.clear();
            state.kickVotes.clear();
            state.activeSessionIds.clear();

            // 게임 상태 초기화
            state.status = YachtRoomStatus.WAITING;
            state.scoreMap.clear();
            state.turnOrder = new ArrayList<>();
            state.turnOrderIndex = 0;
            state.roundIndex = 0;
            state.dice = new int[]{0, 0, 0, 0, 0};
            state.keptIndices = new ArrayList<>();
            state.rollsLeft = YachtScoreRulesFactory.get(state.diceType).maxRollsPerTurn();
            state.hasRolled = false;
            state.readySet.clear();
            // 봇은 WebSocket 클라이언트가 없으므로 자동 준비 복원
            if (yachtBotService != null) {
                state.participants.stream()
                        .map(p -> p.userId)
                        .filter(yachtBotService::isBot)
                        .forEach(state.readySet::add);
            }

            // 방장이 끊겨 사라졌다면 새 방장 위임 (남은 첫 참가자)
            if (!state.participants.isEmpty()) {
                boolean hostStillIn = state.participants.stream()
                        .anyMatch(p -> p.userId.equals(state.hostUserId));
                if (!hostStillIn) {
                    state.hostUserId = state.participants.get(0).userId;
                }
            }
        }

        // DB 갱신: 방 WAITING 복귀, 승자/시작 시각 초기화
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(YachtRoomStatus.WAITING);
            room.setStartedAt(null);
            room.setWinnerUserIds(null);
            room.setHostUserId(state.hostUserId);
            room.setCurrentPlayers(state.participants.size());
            yachtRoomRepository.save(room);
            // 이전 게임의 yacht_score 일괄 삭제 (UNIQUE 제약 회피)
            yachtScoreRepository.deleteByRoom(room);
        });

        // 갱신된 참가자/상태를 클라이언트에 통지 (관전자였던 사람도 isSpectator=false로 바뀜)
        broadcastRoomState(state);
    }

    private List<YachtRankingEntryDto> computeRankings(YachtRoomState state, List<YachtPlayer> participants) {
        // 관전자(turnOrder에 없는 사람)는 랭킹에서 제외
        Set<Long> ranked = new HashSet<>(state.turnOrder);
        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);

        // userId → 최종 점수 계산
        Map<Long, Integer> totals = new LinkedHashMap<>();
        for (YachtPlayer p : participants) {
            if (!ranked.contains(p.userId)) continue;
            Map<String, Integer> scores = state.scoreMap.getOrDefault(p.userId, new ConcurrentHashMap<>());
            int upper = computeUpperTotal(scores, rules);
            int grand = computeGrandTotal(scores, upper, isBonusEarned(scores, rules), rules);
            totals.put(p.userId, grand);
        }

        // 내림차순 정렬
        List<Map.Entry<Long, Integer>> sorted = totals.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .collect(Collectors.toList());

        // 닉네임 맵
        Map<Long, String> nicknames = participants.stream()
                .collect(Collectors.toMap(p -> p.userId, p -> p.nickname));

        List<YachtRankingEntryDto> result = new ArrayList<>();
        int rank = 1;
        int prev = -1;
        int sameRankCount = 0;

        for (int i = 0; i < sorted.size(); i++) {
            Map.Entry<Long, Integer> entry = sorted.get(i);
            int score = entry.getValue();

            if (score == prev) {
                sameRankCount++;
            } else {
                rank = i + 1;
                sameRankCount = 0;
            }

            result.add(YachtRankingEntryDto.builder()
                    .rank(rank)
                    .userId(entry.getKey())
                    .nickname(nicknames.getOrDefault(entry.getKey(), "Unknown"))
                    .grandTotal(score)
                    .isWinner(rank == 1)
                    .build());

            prev = score;
        }

        return result;
    }

    // ─── 상단 보너스 계산 (룰셋 기반) ────────────────────────────────────────

    private int computeUpperTotal(Map<String, Integer> scores, YachtScoreRules rules) {
        int sum = 0;
        for (String key : rules.upperKeys()) {
            sum += scores.getOrDefault(key, 0);
        }
        return sum;
    }

    /**
     * 상단 족보 전체가 기록되었고 합계 >= 임계값이면 보너스 획득.
     * 임계값은 룰셋에서 가져옴 (D6=63 / D8=84).
     */
    private boolean isBonusEarned(Map<String, Integer> scores, YachtScoreRules rules) {
        boolean allUpperFilled = rules.upperKeys().stream().allMatch(scores::containsKey);
        if (!allUpperFilled) return false;
        return computeUpperTotal(scores, rules) >= rules.upperBonusThreshold();
    }

    /**
     * 이번 족보 선택이 보너스를 막 획득하게 만들었는지 확인.
     */
    private boolean isBonusJustEarned(Map<String, Integer> scores, String justRecordedKey, YachtScoreRules rules) {
        if (!rules.upperKeys().contains(justRecordedKey)) return false;
        return isBonusEarned(scores, rules);
    }

    private int computeGrandTotal(Map<String, Integer> scores, int upperTotal, boolean bonusEarned, YachtScoreRules rules) {
        int lowerTotal = 0;
        for (Map.Entry<String, Integer> e : scores.entrySet()) {
            if (!rules.upperKeys().contains(e.getKey())) {
                lowerTotal += e.getValue();
            }
        }
        return upperTotal + (bonusEarned ? rules.upperBonusValue() : 0) + lowerTotal;
    }

    // ─── 게임 상태 헬퍼 ──────────────────────────────────────────────────────

    private Long currentTurnUserId(YachtRoomState state) {
        if (state.turnOrder.isEmpty()) return null;
        return state.turnOrder.get(state.turnOrderIndex % state.turnOrder.size());
    }

    /**
     * 턴 순서에 들어있는 모든 플레이어가 총 족보 수를 채웠는지 확인.
     * 족보 수는 룰셋에서 가져옴 (D6=12 / D8=14).
     * disconnected 플레이어는 autoFill로 이미 채워졌으므로 포함.
     * reconnecting 플레이어는 족보가 남아있을 수 있으므로 반드시 포함하여 체크.
     * (reconnecting을 continue로 건너뛰면 족보 미완료 상태에서 게임 강제 종료되는 버그 발생)
     * 게임 중 합류한 관전자(turnOrder에 없음)는 제외.
     */
    private boolean isGameOver(YachtRoomState state) {
        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
        for (Long playerId : state.turnOrder) {
            Map<String, Integer> scores = state.scoreMap.getOrDefault(playerId, new ConcurrentHashMap<>());
            if (scores.size() < rules.totalScoreKeys()) return false;
        }
        return !state.turnOrder.isEmpty();
    }

    // ─── ROOM_STATE / TURN_STATE 브로드캐스트 ────────────────────────────────

    /**
     * 관전자 판정: 게임 진행 중인 방에서 turnOrder에 없는 참가자.
     * WAITING/FINISHED 또는 turnOrder에 포함된 사용자는 false.
     */
    private boolean isSpectator(YachtRoomState state, Long userId) {
        if (state.status != YachtRoomStatus.PLAYING) return false;
        return !state.turnOrder.contains(userId);
    }

    private void broadcastRoomState(YachtRoomState state) {
        List<YachtParticipantDto> participants;
        Long hostUserId;
        YachtRoomStatus status;
        String diceTypeName;

        synchronized (state) {
            hostUserId   = state.hostUserId;
            status       = state.status;
            diceTypeName = state.diceType.name();
            participants = state.participants.stream()
                    .map(p -> YachtParticipantDto.builder()
                            .userId(p.userId)
                            .nickname(p.nickname)
                            .profileImageUrl(p.userId != null ? userRepository.findById(p.userId).map(u -> u.getProfileImage()).orElse(null) : null)
                            .ready(state.readySet.contains(p.userId) || p.userId.equals(state.hostUserId))
                            .isHost(p.userId.equals(state.hostUserId))
                            .isSpectator(isSpectator(state, p.userId))
                            .isReconnecting(state.reconnectingPlayers.contains(p.userId))
                            .build())
                    .collect(Collectors.toList());
        }

        broadcast(state.roomId, "ROOM_STATE", YachtRoomStatePayload.builder()
                .roomId(state.roomId)
                .status(status.name())
                .diceType(diceTypeName)
                .hostUserId(hostUserId)
                .maxPlayers(state.maxPlayers)
                .participants(participants)
                .build());
    }

    private void broadcastTurnState(YachtRoomState state) {
        Long currentTurn;
        int rollsLeft;
        int[] dice;
        List<Integer> keptIndices;
        int roundIndex;

        synchronized (state) {
            currentTurn = currentTurnUserId(state);
            rollsLeft   = state.rollsLeft;
            dice        = Arrays.copyOf(state.dice, 5);
            keptIndices = new ArrayList<>(state.keptIndices);
            roundIndex  = state.roundIndex;
        }

        broadcast(state.roomId, "TURN_STATE", YachtTurnStatePayload.builder()
                .currentTurnUserId(currentTurn)
                .rollsLeft(rollsLeft)
                .dice(dice)
                .keptIndices(keptIndices)
                .roundIndex(roundIndex)
                .build());
    }

    // ─── DB 헬퍼 ──────────────────────────────────────────────────────────────

    @Transactional
    void saveScoreToDB(String roomId, Long userId, String scoreKey, int scoreValue) {
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            // 이미 존재하면 저장 안 함 (UNIQUE 제약)
            boolean exists = yachtScoreRepository
                    .findByRoomAndUserIdAndScoreKey(room, userId, scoreKey)
                    .isPresent();
            if (!exists) {
                YachtScore score = YachtScore.builder()
                        .room(room)
                        .userId(userId)
                        .scoreKey(scoreKey)
                        .scoreValue(scoreValue)
                        .build();
                yachtScoreRepository.save(score);
            }
        });
    }

    @Transactional
    void updateDbStatusPlaying(String roomId) {
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(YachtRoomStatus.PLAYING);
            room.setStartedAt(LocalDateTime.now(ZoneOffset.UTC));
            yachtRoomRepository.save(room);
        });
    }

    @Transactional
    void updateDbFinished(String roomId, List<Long> winnerIds) {
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(YachtRoomStatus.FINISHED);
            room.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            room.setWinnerUserIds(winnerIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(",")));
            yachtRoomRepository.save(room);
        });
    }

    @Transactional
    void updateDbHost(String roomId, Long newHostId) {
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setHostUserId(newHostId);
            yachtRoomRepository.save(room);
        });
    }

    @Transactional
    void markParticipantLeft(String roomId, Long userId) {
        yachtRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            yachtParticipantRepository.findByRoomAndUserId(room, userId).ifPresent(p -> {
                p.setLeftAt(LocalDateTime.now(ZoneOffset.UTC));
                yachtParticipantRepository.save(p);
            });
        });
    }

    private void closeRoom(YachtRoomState state, String reason) {
        synchronized (state) {
            state.status = YachtRoomStatus.FINISHED;
        }
        rooms.remove(state.roomId);

        broadcast(state.roomId, "ROOM_CLOSED", YachtRoomClosedPayload.builder()
                .roomId(state.roomId)
                .reason(reason)
                .build());

        yachtRoomRepository.findByRoomId(state.roomId).ifPresent(room -> {
            room.setStatus(YachtRoomStatus.FINISHED);
            room.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            yachtRoomRepository.save(room);
        });

        log.info("closeRoom: roomId={} reason={}", state.roomId, reason);
    }

    // ─── TTL 스윕 ─────────────────────────────────────────────────────────────

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sweepStaleRooms() {
        LocalDateTime cutoff = LocalDateTime.now(ZoneOffset.UTC).minusMinutes(ROOM_TTL_MINUTES);
        List<YachtRoom> stale = yachtRoomRepository.findStaleWaitingRooms(YachtRoomStatus.WAITING, cutoff);
        for (YachtRoom room : stale) {
            rooms.remove(room.getRoomId());
            room.setStatus(YachtRoomStatus.FINISHED);
            room.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            yachtRoomRepository.save(room);
            log.info("sweepStaleRooms: roomId={} TTL 만료 FINISHED", room.getRoomId());
        }
    }

    // ─── 브로드캐스트 헬퍼 ───────────────────────────────────────────────────

    private void broadcast(String roomId, String type, Object payload) {
        YachtEnvelopeDto envelope = YachtEnvelopeDto.builder()
                .type(type)
                .timestamp(formatNow())
                .payload(payload)
                .build();
        messagingTemplate.convertAndSend(TOPIC_PREFIX + roomId, envelope);
    }

    private String formatNow() {
        return Instant.now().atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    }

    // ─── 상태 조회 (컨트롤러용) ──────────────────────────────────────────────

    public YachtRoomState getState(String roomId) {
        return rooms.get(roomId);
    }

    public int getActiveRoomCount() {
        return (int) rooms.values().stream()
                .filter(s -> !s.participants.isEmpty())
                .count();
    }

    public int getActiveTotalPlayerCount() {
        return rooms.values().stream()
                .mapToInt(s -> s.participants.size())
                .sum();
    }

    public Optional<String> findActiveRoomId(Long userId) {
        return rooms.values().stream()
                .filter(s -> s.participants.stream().anyMatch(p -> p.userId.equals(userId)))
                .map(s -> s.roomId)
                .findFirst();
    }

    public boolean isParticipant(String roomId, Long userId) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return false;
        return state.participants.stream().anyMatch(p -> p.userId.equals(userId));
    }

    /**
     * GET /api/yacht/room/{roomId} 응답용 스냅샷 생성.
     */
    public Map<String, Object> buildRoomSnapshot(String roomId, Long requesterId) {
        YachtRoomState state = rooms.get(roomId);
        if (state == null) return null;

        synchronized (state) {
            if (!state.participants.stream().anyMatch(p -> p.userId.equals(requesterId))) {
                return null; // NOT_IN_ROOM
            }

            List<YachtParticipantDto> participants = state.participants.stream()
                    .map(p -> YachtParticipantDto.builder()
                            .userId(p.userId)
                            .nickname(p.nickname)
                            .profileImageUrl(p.userId != null ? userRepository.findById(p.userId).map(u -> u.getProfileImage()).orElse(null) : null)
                            .ready(state.readySet.contains(p.userId) || p.userId.equals(state.hostUserId))
                            .isHost(p.userId.equals(state.hostUserId))
                            .isSpectator(isSpectator(state, p.userId))
                            .isReconnecting(state.reconnectingPlayers.contains(p.userId))
                            .build())
                    .collect(Collectors.toList());

            // 점수판 — 관전자 제외, 룰셋에서 키 셋 가져옴 (D6: 12개, D8: 14개)
            YachtScoreRules snapshotRules = YachtScoreRulesFactory.get(state.diceType);
            List<YachtScoreboardDto> scoreboard = state.participants.stream()
                    .filter(p -> !isSpectator(state, p.userId))
                    .map(p -> {
                        Map<String, Integer> scores = state.scoreMap.getOrDefault(p.userId, new ConcurrentHashMap<>());
                        // null 포함 전체 맵 생성 (D6: 12개, D8: 14개)
                        Map<String, Integer> fullScores = new LinkedHashMap<>();
                        for (String key : snapshotRules.validScoreKeys()) {
                            fullScores.put(key, scores.getOrDefault(key, null));
                        }
                        int upper = computeUpperTotal(scores, snapshotRules);
                        boolean bonus = isBonusEarned(scores, snapshotRules);
                        int grand = computeGrandTotal(scores, upper, bonus, snapshotRules);
                        return YachtScoreboardDto.builder()
                                .userId(p.userId)
                                .scores(fullScores)
                                .upperTotal(upper)
                                .bonusEarned(bonus)
                                .grandTotal(grand)
                                .build();
                    })
                    .collect(Collectors.toList());

            Long currentTurn = state.status == YachtRoomStatus.PLAYING ? currentTurnUserId(state) : null;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("roomId", state.roomId);
            result.put("status", state.status.name());
            result.put("diceType", state.diceType.name());
            result.put("hostUserId", state.hostUserId);
            result.put("maxPlayers", state.maxPlayers);
            result.put("currentTurnUserId", currentTurn);
            result.put("turnOrder", state.status == YachtRoomStatus.PLAYING ? state.turnOrder : null);
            result.put("roundIndex", state.roundIndex);
            result.put("participants", participants);
            result.put("scoreboard", scoreboard);
            if (state.status == YachtRoomStatus.PLAYING) {
                result.put("currentDice", Arrays.copyOf(state.dice, 5));
                result.put("currentKeptIndices", new ArrayList<>(state.keptIndices));
                result.put("currentRollsLeft", state.rollsLeft);
            }
            return result;
        }
    }
}
