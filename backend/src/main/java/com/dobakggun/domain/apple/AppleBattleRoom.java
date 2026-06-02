package com.dobakggun.domain.apple;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 사과게임 배틀 인메모리 방 도메인 객체.
 * JPA 엔티티가 아님 — AppleBattleRoomManager 가 ConcurrentHashMap 으로 보관.
 *
 * <p>핵심 규칙:
 * <ul>
 *   <li>2명이 동일한 10×17 보드를 공유</li>
 *   <li>한 플레이어가 셀을 제거하면 서버의 공유 보드에서 제거 → 양쪽 브로드캐스트</li>
 *   <li>120초 타이머 후 GAME_RESULT</li>
 *   <li>보드 완전 클리어 시 즉시 GAME_RESULT (reason: BOARD_CLEARED)</li>
 * </ul>
 */
@Getter
@Setter
public class AppleBattleRoom {

    // ─── 상수 ─────────────────────────────────────────────────────────────────

    public static final int ROWS = 10;
    public static final int COLS = 17;

    // ─── 방 상태 ──────────────────────────────────────────────────────────────

    public enum Status {
        WAITING,    // 1명 대기 중
        MATCHED,    // 2명 입장, 카운트다운 대기 (WS 연결 대기)
        PLAYING,    // 게임 진행 중
        FINISHED    // 종료
    }

    private final String roomId;
    private volatile Status status;

    /** 참가자 목록 (최대 2명) */
    private final List<PlayerInfo> players = new ArrayList<>(2);

    /** 점수 (playerId → score) */
    private final ConcurrentHashMap<String, Integer> scores = new ConcurrentHashMap<>();

    // ─── 공유 보드 ────────────────────────────────────────────────────────────

    /**
     * 공유 보드 — null = 제거된 셀, 1~9 = 남은 사과.
     * ReentrantLock 으로 동시 접근 제어.
     */
    private volatile Integer[][] board;

    /** 보드 동시 접근 제어 Lock */
    private final ReentrantLock lock = new ReentrantLock(true);

    // ─── 타임스탬프 ───────────────────────────────────────────────────────────

    private volatile Instant matchedAt;
    private volatile Instant gameStartedAt;

    // ─── 종료 보호 ───────────────────────────────────────────────────────────

    /**
     * finishGame 중복 호출 방지.
     * compareAndSet(false → true) 성공한 쪽만 finishGame 실행.
     */
    private final AtomicBoolean finished = new AtomicBoolean(false);

    // ─── 타이머 Future ────────────────────────────────────────────────────────

    /** 3초 카운트다운 스케줄 Future */
    private volatile ScheduledFuture<?> countdownFuture;

    /** 120초 게임 종료 타이머 Future */
    private volatile ScheduledFuture<?> gameEndFuture;

    /** 연결 끊김 grace period Future (playerId → Future) */
    private final ConcurrentHashMap<String, ScheduledFuture<?>> disconnectFutures = new ConcurrentHashMap<>();

    /** FINISHED 후 방 정리 Future */
    private volatile ScheduledFuture<?> closeRoomFuture;

    /** 재대결 요청한 플레이어 집합 */
    private final ConcurrentHashMap<String, Boolean> rematchRequested = new ConcurrentHashMap<>();

    // ─── 생성자 ───────────────────────────────────────────────────────────────

    public AppleBattleRoom(String roomId) {
        this.roomId = roomId;
        this.status = Status.WAITING;
    }

    // ─── 편의 메서드 ──────────────────────────────────────────────────────────

    /** 방에 속한 플레이어 수 */
    public int getPlayerCount() {
        return players.size();
    }

    /** playerId 로 플레이어 조회 */
    public PlayerInfo findPlayer(String playerId) {
        return players.stream()
                .filter(p -> p.getPlayerId().equals(playerId))
                .findFirst()
                .orElse(null);
    }

    /** sessionId 로 플레이어 조회 */
    public PlayerInfo findPlayerBySession(String sessionId) {
        return players.stream()
                .filter(p -> sessionId.equals(p.getSessionId()))
                .findFirst()
                .orElse(null);
    }

    /** 상대 플레이어 조회 */
    public PlayerInfo findOpponent(String playerId) {
        return players.stream()
                .filter(p -> !p.getPlayerId().equals(playerId))
                .findFirst()
                .orElse(null);
    }

    /**
     * 현재 보드에 null이 아닌 셀이 하나도 없으면 true (보드 완전 클리어).
     */
    public boolean isBoardCleared() {
        if (board == null) return false;
        for (Integer[] row : board) {
            for (Integer cell : row) {
                if (cell != null) return false;
            }
        }
        return true;
    }

    // ─── 플레이어 정보 Inner Class ────────────────────────────────────────────

    @Getter
    @Setter
    public static class PlayerInfo {

        /** userId string (로그인) 또는 guest_{uuid} (게스트) */
        private final String playerId;
        private final String nickname;
        private final boolean guest;
        /** 게스트이면 null */
        private final Long userId;

        /** STOMP 세션 ID — WS 연결 후 등록 */
        private volatile String sessionId;

        /** WS 연결 상태 */
        private volatile boolean connected;

        /** 연결 끊김 여부 (grace period 중) */
        private volatile boolean disconnected;

        /** 자발적 이탈 여부 */
        private volatile boolean voluntaryLeft;

        public PlayerInfo(String playerId, String nickname, boolean guest, Long userId) {
            this.playerId = playerId;
            this.nickname = nickname;
            this.guest = guest;
            this.userId = userId;
            this.connected = false;
            this.disconnected = false;
            this.voluntaryLeft = false;
        }
    }
}
