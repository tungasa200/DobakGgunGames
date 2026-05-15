package com.dobakggun.service;

import com.dobakggun.dto.rps.*;
import com.dobakggun.entity.rps.*;
import com.dobakggun.repository.RpsPlayerStatRepository;
import com.dobakggun.repository.RpsRoomRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
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
 * Online RPS 방 인메모리 상태 관리 서비스.
 *
 * - ConcurrentHashMap 으로 방 상태를 관리.
 * - MATCH_COUNTDOWN (5초) / GAME_TIMEOUT (10초) 타이머는 ThreadPoolTaskScheduler 로 관리.
 * - 브로드캐스트는 SimpMessagingTemplate 사용.
 */
@Slf4j
@Service
public class RpsRoomService {

    private static final int COUNTDOWN_SECONDS = 5;
    static final int TIMEOUT_SECONDS = 10;
    private static final int ROOM_TTL_MINUTES = 10;
    private static final String TOPIC_PREFIX = "/topic/rps/room/";

    // ─── 인메모리 상태 ────────────────────────────────────────────────────────

    /**
     * 방 인메모리 상태.
     * 외부에서 직접 접근하지 않도록 package-private 이너 클래스로 관리.
     */
    public static class RpsRoomState {
        public final String roomId;
        public volatile Long hostUserId;
        public volatile String roomName;
        public volatile int maxPlayers;
        public final List<RpsParticipant> participants = new CopyOnWriteArrayList<>();
        public volatile int currentRoundNum = 0;
        public final Map<Long, RpsChoice> roundChoices = new ConcurrentHashMap<>();
        /** 타임아웃 전에 자발적으로 선택한 유저 ID 집합 */
        public final Set<Long> voluntaryChoosers = ConcurrentHashMap.newKeySet();
        public volatile ScheduledFuture<?> countdownFuture;
        public volatile ScheduledFuture<?> roundTimeoutFuture;
        public volatile RoomStatus status = RoomStatus.WAITING;

        public RpsRoomState(String roomId, Long hostUserId, String roomName, int maxPlayers) {
            this.roomId = roomId;
            this.hostUserId = hostUserId;
            this.roomName = roomName;
            this.maxPlayers = maxPlayers;
        }

        /** 이전 생성자 호환 (roomName/maxPlayers 미지정 시 기본값 사용) */
        public RpsRoomState(String roomId, Long hostUserId) {
            this(roomId, hostUserId, roomId, 4);
        }
    }

    public static class RpsParticipant {
        public final Long userId;
        public final String nickname;

        public RpsParticipant(Long userId, String nickname) {
            this.userId = userId;
            this.nickname = nickname;
        }
    }

    private final ConcurrentHashMap<String, RpsRoomState> rooms = new ConcurrentHashMap<>();

    // ─── 의존성 ───────────────────────────────────────────────────────────────

    private final RpsRoomRepository rpsRoomRepository;
    private final RpsPlayerStatRepository rpsPlayerStatRepository;
    private final ThreadPoolTaskScheduler taskScheduler;
    private final RpsGameService rpsGameService;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public RpsRoomService(
            RpsRoomRepository rpsRoomRepository,
            RpsPlayerStatRepository rpsPlayerStatRepository,
            @Qualifier("rpsTaskScheduler") ThreadPoolTaskScheduler taskScheduler,
            RpsGameService rpsGameService) {
        this.rpsRoomRepository = rpsRoomRepository;
        this.rpsPlayerStatRepository = rpsPlayerStatRepository;
        this.taskScheduler = taskScheduler;
        this.rpsGameService = rpsGameService;
    }

    // ─── 초기화 ───────────────────────────────────────────────────────────────

    /**
     * 서버 재시작 시 DB의 WAITING/PLAYING 방을 모두 FINISHED 처리.
     * 인메모리 맵은 이미 비어있으므로 DB만 정리.
     * ApplicationReadyEvent 사용: @PostConstruct + @Transactional 조합의 AOP 프록시 우회 문제 방지.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void closeStaleRoomsOnStartup() {
        List<RoomStatus> active = List.of(RoomStatus.WAITING, RoomStatus.PLAYING);
        int closed = rpsRoomRepository.closeAllActiveRooms(
                RoomStatus.FINISHED,
                LocalDateTime.now(ZoneOffset.UTC),
                active);
        if (closed > 0) {
            log.info("RpsRoomService: 서버 재시작 — 좀비 방 {}개 FINISHED 처리", closed);
        }
    }

    // ─── 방 참가 ──────────────────────────────────────────────────────────────

    /**
     * 방 WebSocket 세션 등록.
     * HTTP 매칭 후 클라이언트가 /app/rps/room/{roomId}/join 발행 시 호출.
     *
     * @return true=정상 처리, false=방 없음/상태 오류
     */
    public boolean joinRoom(String roomId, Long userId, String nickname) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) {
            // 인메모리 상태 없음 → DB에서 방 정보 조회 후 초기화
            RpsRoom dbRoom = rpsRoomRepository.findByRoomId(roomId).orElse(null);
            String roomName = dbRoom != null ? dbRoom.getName() : roomId;
            int maxPlayers = dbRoom != null ? dbRoom.getMaxPlayers() : 4;
            state = rooms.computeIfAbsent(roomId,
                    id -> new RpsRoomState(id, userId, roomName, maxPlayers));
        }

        synchronized (state) {
            if (state.status != RoomStatus.WAITING) {
                log.warn("joinRoom: 방 {} 가 WAITING 상태 아님 ({})", roomId, state.status);
                return false;
            }

            // 이미 참가 중인지 확인
            boolean alreadyIn = state.participants.stream()
                    .anyMatch(p -> p.userId.equals(userId));
            if (alreadyIn) {
                log.info("joinRoom: userId={} 이미 방 {} 에 참가 중", userId, roomId);
                broadcastRoomState(state);
                return true;
            }

            // 방장이 아직 미설정이면 이 참가자가 방장
            if (state.hostUserId == null) {
                state.hostUserId = userId;
            }

            state.participants.add(new RpsParticipant(userId, nickname));
            log.info("joinRoom: userId={} 방 {} 입장 (현재 {}명)", userId, roomId, state.participants.size());
        }

        broadcastRoomState(state);
        checkAndStartCountdown(state);
        return true;
    }

    // ─── 방 퇴장 ──────────────────────────────────────────────────────────────

    /**
     * 방 퇴장 처리.
     *
     * @param reason "LEAVE" 또는 "DISCONNECT"
     */
    public void leaveRoom(String roomId, Long userId, String reason) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return;

        String nickname;
        boolean wasHost;
        int remaining;

        synchronized (state) {
            RpsParticipant leaving = state.participants.stream()
                    .filter(p -> p.userId.equals(userId))
                    .findFirst()
                    .orElse(null);

            if (leaving == null) return;

            nickname = leaving.nickname;
            wasHost = userId.equals(state.hostUserId);
            state.participants.remove(leaving);
            // 현재 라운드 선택도 제거
            state.roundChoices.remove(userId);
            remaining = state.participants.size();
        }

        // PLAYER_LEFT 브로드캐스트
        broadcast(roomId, "PLAYER_LEFT", RpsPlayerLeftDto.builder()
                .roomId(roomId)
                .userId(userId)
                .nickname(nickname)
                .reason(reason)
                .build());

        if (remaining == 0) {
            // 전원 퇴장
            closeRoom(state, "EMPTY");
            return;
        }

        synchronized (state) {
            if (wasHost && !state.participants.isEmpty()) {
                // 방장 이전 — 가장 먼저 입장한 잔존자
                RpsParticipant newHost = state.participants.get(0);
                state.hostUserId = newHost.userId;
                broadcast(roomId, "HOST_CHANGED", RpsHostChangedDto.builder()
                        .roomId(roomId)
                        .newHostUserId(newHost.userId)
                        .newHostNickname(newHost.nickname)
                        .build());
            }
        }

        broadcastRoomState(state);

        // PLAYING 중 퇴장: 게임 진행 가능 여부 확인
        boolean isPlaying;
        synchronized (state) {
            isPlaying = (state.status == RoomStatus.PLAYING);
        }

        if (isPlaying) {
            if (remaining == 1) {
                // 잔존 1명이면 바로 결과 처리
                cancelRoundTimeout(state);
                processRoundResult(roomId);
                return;
            }
            // 모두 선택 완료했는지 확인 (떠난 참가자 제거 후)
            checkAllChosen(state);
            return;
        }

        // WAITING: 인원 감소 → 카운트다운 취소 필요 여부 확인
        synchronized (state) {
            if (state.status == RoomStatus.WAITING && state.participants.size() < 2) {
                cancelCountdown(state);
            }
        }
    }

    // ─── 카드 선택 처리 ───────────────────────────────────────────────────────

    /**
     * 플레이어 카드 선택 등록.
     *
     * @return true=정상, false=오류(이미 선택/PLAYING 아님)
     */
    public String recordChoice(String roomId, Long userId, RpsChoice choice) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        synchronized (state) {
            if (state.status != RoomStatus.PLAYING) return "GAME_NOT_ACTIVE";

            boolean isParticipant = state.participants.stream()
                    .anyMatch(p -> p.userId.equals(userId));
            if (!isParticipant) return "NOT_IN_ROOM";

            if (state.roundChoices.containsKey(userId)) return "ALREADY_CHOSEN";

            state.roundChoices.put(userId, choice);
            state.voluntaryChoosers.add(userId); // 자발적 선택 기록
            log.info("recordChoice: roomId={} userId={} choice={}", roomId, userId, choice);
        }

        checkAllChosen(state);
        return null; // null = 성공
    }

    // ─── 재도전 ───────────────────────────────────────────────────────────────

    /**
     * 명시적 재도전 요청 처리.
     * 현재 인원이 >= 2이면 즉시 MATCH_COUNTDOWN 재시작.
     */
    public String rematch(String roomId, Long userId) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return "ROOM_NOT_FOUND";

        synchronized (state) {
            if (state.status != RoomStatus.WAITING) return "INVALID_ACTION";
            if (state.participants.size() < 2) return "NOT_ENOUGH_PLAYERS";
        }

        checkAndStartCountdown(state);
        return null;
    }

    // ─── 카운트다운 ───────────────────────────────────────────────────────────

    private void checkAndStartCountdown(RpsRoomState state) {
        synchronized (state) {
            if (state.status != RoomStatus.WAITING) return;
            if (state.participants.size() < 2) return;
            // 이미 카운트다운 진행 중이면 중복 시작 안 함
            if (state.countdownFuture != null && !state.countdownFuture.isDone()) return;
        }
        startMatchCountdown(state);
    }

    private void startMatchCountdown(RpsRoomState state) {
        Instant startAt = Instant.now().plusSeconds(COUNTDOWN_SECONDS);

        broadcast(state.roomId, "MATCH_COUNTDOWN", RpsMatchCountdownDto.builder()
                .roomId(state.roomId)
                .secondsRemaining(COUNTDOWN_SECONDS)
                .startAt(formatInstant(startAt))
                .build());

        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> onCountdownExpired(state.roomId),
                startAt
        );

        synchronized (state) {
            state.countdownFuture = future;
        }

        log.info("startMatchCountdown: roomId={} startAt={}", state.roomId, startAt);
    }

    private void cancelCountdown(RpsRoomState state) {
        ScheduledFuture<?> future;
        synchronized (state) {
            future = state.countdownFuture;
            state.countdownFuture = null;
        }
        if (future != null && !future.isDone()) {
            future.cancel(false);
            broadcast(state.roomId, "MATCH_COUNTDOWN_CANCELLED", RpsMatchCountdownDto.builder()
                    .roomId(state.roomId)
                    .reason("PLAYER_LEFT_BELOW_MIN")
                    .build());
            log.info("cancelCountdown: roomId={}", state.roomId);
        }
    }

    private void onCountdownExpired(String roomId) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return;

        List<Long> participantIds;
        int roundNum;

        synchronized (state) {
            if (state.status != RoomStatus.WAITING) return;
            if (state.participants.size() < 2) return;

            state.status = RoomStatus.PLAYING;
            state.currentRoundNum++;
            state.roundChoices.clear();
            state.voluntaryChoosers.clear();

            participantIds = state.participants.stream()
                    .map(p -> p.userId)
                    .collect(Collectors.toList());
            roundNum = state.currentRoundNum;
        }

        // GAME_STARTED 브로드캐스트
        Instant deadline = Instant.now().plusSeconds(TIMEOUT_SECONDS);

        broadcast(state.roomId, "GAME_STARTED", RpsGameStartedDto.builder()
                .roomId(roomId)
                .roundNum(roundNum)
                .deadlineAt(formatInstant(deadline))
                .timeoutSeconds(TIMEOUT_SECONDS)
                .participantUserIds(participantIds)
                .build());

        // 10초 타임아웃 스케줄
        ScheduledFuture<?> timeoutFuture = taskScheduler.schedule(
                () -> onRoundTimeout(roomId),
                deadline
        );
        synchronized (state) {
            state.roundTimeoutFuture = timeoutFuture;
        }

        // DB: 방 상태 PLAYING 업데이트
        updateDbStatus(roomId, RoomStatus.PLAYING);
        log.info("onCountdownExpired → GAME_STARTED roomId={} round={}", roomId, roundNum);
    }

    // ─── 라운드 타임아웃 ──────────────────────────────────────────────────────

    private void onRoundTimeout(String roomId) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return;

        synchronized (state) {
            if (state.status != RoomStatus.PLAYING) return;

            // 미선택자 자동 랜덤 선택
            RpsChoice[] choices = RpsChoice.values();
            for (RpsParticipant p : state.participants) {
                if (!state.roundChoices.containsKey(p.userId)) {
                    RpsChoice auto = choices[ThreadLocalRandom.current().nextInt(choices.length)];
                    state.roundChoices.put(p.userId, auto);
                    log.info("onRoundTimeout: auto-pick userId={} choice={}", p.userId, auto);
                }
            }
        }

        processRoundResult(roomId);
    }

    private void cancelRoundTimeout(RpsRoomState state) {
        ScheduledFuture<?> future;
        synchronized (state) {
            future = state.roundTimeoutFuture;
            state.roundTimeoutFuture = null;
        }
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
    }

    // ─── 전원 선택 완료 체크 ─────────────────────────────────────────────────

    private void checkAllChosen(RpsRoomState state) {
        boolean allChosen;
        synchronized (state) {
            if (state.status != RoomStatus.PLAYING) return;
            allChosen = state.participants.stream()
                    .allMatch(p -> state.roundChoices.containsKey(p.userId));
        }

        if (allChosen) {
            cancelRoundTimeout(state);
            processRoundResult(state.roomId);
        }
    }

    // ─── 라운드 결과 처리 ─────────────────────────────────────────────────────

    public void processRoundResult(String roomId) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return;

        Map<Long, RpsChoice> choicesSnapshot;
        List<RpsParticipant> participantsSnapshot;
        int roundNum;

        Set<Long> voluntarySnapshot;
        synchronized (state) {
            if (state.status != RoomStatus.PLAYING) return;

            choicesSnapshot = new HashMap<>(state.roundChoices);
            participantsSnapshot = new ArrayList<>(state.participants);
            voluntarySnapshot = new HashSet<>(state.voluntaryChoosers);
            roundNum = state.currentRoundNum;
        }

        // 판정
        Map<Long, RpsResult> judgedResults;
        if (participantsSnapshot.size() == 1) {
            // 상대방 퇴장으로 인한 몰수패: 잔존 플레이어 WIN
            judgedResults = new HashMap<>();
            judgedResults.put(participantsSnapshot.get(0).userId, RpsResult.WIN);
        } else {
            judgedResults = rpsGameService.judge(choicesSnapshot);
        }

        // 승패 통계 저장 (로그인 유저만)
        saveMatchStats(participantsSnapshot, judgedResults);

        // 저장 후 최신 승률 조회
        List<Long> pIds = participantsSnapshot.stream().map(p -> p.userId).toList();
        Map<Long, Double> winRateMap = fetchWinRateMap(pIds);

        // ROUND_RESULT payload 구성
        List<RpsPlayerResultDto> resultList = new ArrayList<>();
        for (RpsParticipant p : participantsSnapshot) {
            RpsChoice choice = choicesSnapshot.get(p.userId);
            RpsResult result = judgedResults.getOrDefault(p.userId, RpsResult.DRAW);
            boolean autoPicked = !voluntarySnapshot.contains(p.userId);
            if (choice == null) choice = RpsChoice.ROCK; // 방어 fallback

            resultList.add(RpsPlayerResultDto.builder()
                    .userId(p.userId)
                    .nickname(p.nickname)
                    .choice(choice.name())
                    .autoPicked(autoPicked)
                    .result(result.name())
                    .winRate(winRateMap.get(p.userId))
                    .build());
        }

        broadcast(roomId, "ROUND_RESULT", RpsRoundResultDto.builder()
                .roomId(roomId)
                .roundNum(roundNum)
                .results(resultList)
                .build());

        // 방 WAITING 리셋
        synchronized (state) {
            state.status = RoomStatus.WAITING;
            state.roundChoices.clear();
            state.voluntaryChoosers.clear();
        }

        broadcastRoomState(state);
        updateDbStatus(roomId, RoomStatus.WAITING);

        // 잔존 인원 >= 2이면 자동 카운트다운 재시작
        checkAndStartCountdown(state);
        log.info("processRoundResult: roomId={} round={} complete", roomId, roundNum);
    }

    // ─── 방 닫기 ──────────────────────────────────────────────────────────────

    private void closeRoom(RpsRoomState state, String reason) {
        synchronized (state) {
            cancelCountdownNobroadcast(state);
            cancelRoundTimeout(state);
            state.status = RoomStatus.FINISHED;
        }

        rooms.remove(state.roomId);

        broadcast(state.roomId, "ROOM_CLOSED", RpsRoomClosedDto.builder()
                .roomId(state.roomId)
                .reason(reason)
                .build());

        updateDbStatusClosed(state.roomId);
        log.info("closeRoom: roomId={} reason={}", state.roomId, reason);
    }

    private void cancelCountdownNobroadcast(RpsRoomState state) {
        ScheduledFuture<?> future = state.countdownFuture;
        state.countdownFuture = null;
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
    }

    // ─── ROOM_STATE 브로드캐스트 ─────────────────────────────────────────────

    public void broadcastRoomState(String roomId) {
        RpsRoomState state = rooms.get(roomId);
        if (state != null) broadcastRoomState(state);
    }

    private void broadcastRoomState(RpsRoomState state) {
        List<RpsParticipantDto> participants;
        Long hostUserId;
        RoomStatus status;
        String roomName;
        int maxPlayers;
        List<Long> participantIds;

        synchronized (state) {
            hostUserId = state.hostUserId;
            status = state.status;
            roomName = state.roomName;
            maxPlayers = state.maxPlayers;
            participantIds = state.participants.stream().map(p -> p.userId).toList();
        }

        Map<Long, Double> winRateMap = fetchWinRateMap(participantIds);

        synchronized (state) {
            participants = state.participants.stream()
                    .map(p -> RpsParticipantDto.builder()
                            .userId(p.userId)
                            .nickname(p.nickname)
                            .isHost(p.userId.equals(state.hostUserId))
                            .winRate(winRateMap.get(p.userId))
                            .build())
                    .collect(Collectors.toList());
        }

        broadcast(state.roomId, "ROOM_STATE", RpsRoomStateDto.builder()
                .roomId(state.roomId)
                .name(roomName)
                .status(status.name())
                .hostUserId(hostUserId)
                .maxPlayers(maxPlayers)
                .participants(participants)
                .build());
    }

    // ─── DB 헬퍼 ──────────────────────────────────────────────────────────────

    void saveMatchStats(List<RpsParticipant> participants, Map<Long, RpsResult> judgedResults) {
        for (RpsParticipant p : participants) {
            if (p.userId < 0) continue; // 게스트 제외
            int win = judgedResults.getOrDefault(p.userId, RpsResult.DRAW) == RpsResult.WIN ? 1 : 0;
            rpsPlayerStatRepository.upsert(p.userId, win);
        }
    }

    private Map<Long, Double> fetchWinRateMap(List<Long> userIds) {
        List<Long> loggedIn = userIds.stream().filter(id -> id > 0).toList();
        if (loggedIn.isEmpty()) return Map.of();
        return rpsPlayerStatRepository.findAllById(loggedIn).stream()
                .collect(Collectors.toMap(
                        com.dobakggun.entity.rps.RpsPlayerStat::getUserId,
                        s -> s.getTotalGames() == 0 ? 0.0
                                : s.getTotalWins() * 100.0 / s.getTotalGames()
                ));
    }

    @Transactional
    void updateDbStatus(String roomId, RoomStatus status) {
        rpsRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(status);
            rpsRoomRepository.save(room);
        });
    }

    @Transactional
    void updateDbStatusClosed(String roomId) {
        rpsRoomRepository.findByRoomId(roomId).ifPresent(room -> {
            room.setStatus(RoomStatus.FINISHED);
            room.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            rpsRoomRepository.save(room);
        });
    }

    // ─── TTL 스윕 ─────────────────────────────────────────────────────────────

    /**
     * 10분간 WAITING 상태로 방치된 방을 자동 close.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sweepStaleRooms() {
        LocalDateTime cutoff = LocalDateTime.now(ZoneOffset.UTC).minusMinutes(ROOM_TTL_MINUTES);
        List<RpsRoom> stale = rpsRoomRepository.findStaleWaitingRooms(RoomStatus.WAITING, cutoff);
        for (RpsRoom room : stale) {
            String roomId = room.getRoomId();
            RpsRoomState state = rooms.remove(roomId);
            if (state != null) {
                synchronized (state) {
                    cancelCountdownNobroadcast(state);
                    cancelRoundTimeout(state);
                }
            }
            room.setStatus(RoomStatus.FINISHED);
            room.setClosedAt(LocalDateTime.now(ZoneOffset.UTC));
            rpsRoomRepository.save(room);
            log.info("sweepStaleRooms: roomId={} TTL 만료로 FINISHED", roomId);
        }
    }

    // ─── 유틸 ────────────────────────────────────────────────────────────────

    private void broadcast(String roomId, String type, Object payload) {
        RpsEnvelopeDto envelope = RpsEnvelopeDto.builder()
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

    private String formatInstant(Instant instant) {
        return instant.atZone(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
    }

    // ─── 상태 조회 (컨트롤러에서 사용) ─────────────────────────────────────

    public RpsRoomState getState(String roomId) {
        return rooms.get(roomId);
    }

    public boolean isParticipant(String roomId, Long userId) {
        RpsRoomState state = rooms.get(roomId);
        if (state == null) return false;
        return state.participants.stream().anyMatch(p -> p.userId.equals(userId));
    }

    /**
     * 해당 유저가 현재 어떤 방에 참가 중인지 반환.
     */
    public Optional<String> findActiveRoomId(Long userId) {
        return rooms.values().stream()
                .filter(s -> s.participants.stream().anyMatch(p -> p.userId.equals(userId)))
                .map(s -> s.roomId)
                .findFirst();
    }
}
