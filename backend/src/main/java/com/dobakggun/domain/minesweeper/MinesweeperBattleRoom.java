package com.dobakggun.domain.minesweeper;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 지뢰찾기 배틀 인메모리 방 도메인 객체.
 * JPA 엔티티가 아님 — MinesweeperBattleRoomManager 가 ConcurrentHashMap 으로 보관.
 */
@Getter
@Setter
public class MinesweeperBattleRoom {

    // ─── 방 상태 ──────────────────────────────────────────────────────────────

    public enum Status {
        WAITING,        // 1명 대기 중
        MATCH_READY,    // 2명 입장, FIRST_CLICK 대기
        PLAYING,        // 게임 진행 중
        FINISHED        // 종료
    }

    private final String roomId;
    private volatile Status status;

    /** 참가자 목록 (최대 2명) */
    private final List<PlayerInfo> players = new ArrayList<>(2);

    // ─── 게임 데이터 ──────────────────────────────────────────────────────────

    /** 양측에 배포된 adjMines 배열 (-1=지뢰, 0~8=인접 지뢰 수) */
    private volatile int[][] adjMines;

    /** 보드 생성에 사용된 시드 (감사 로깅용) */
    private volatile long seed;

    /** 서버 기준 게임 시작 시각 (ms) */
    private volatile long serverStartAtMillis;

    /** FIRST_CLICK 수신 플레이어 집합 */
    private final Set<String> firstClickSet = ConcurrentHashMap.newKeySet();

    // ─── 종료 보호 ───────────────────────────────────────────────────────────

    /**
     * finishGame 중복 호출 방지 (BOARD_CLEAR + MINE_HIT 동시 도달, 타임아웃과 충돌 등).
     * compareAndSet(false → true) 성공한 쪽만 finishGame 실행.
     */
    private final AtomicBoolean finished = new AtomicBoolean(false);

    // ─── 타이머 Future ────────────────────────────────────────────────────────

    /** MATCH_READY 이후 30초 FIRST_CLICK 타임아웃 Future */
    private volatile ScheduledFuture<?> firstClickTimeoutFuture;

    /** 연결 끊김 grace period Future (playerId → Future) */
    private final ConcurrentHashMap<String, ScheduledFuture<?>> disconnectFutures = new ConcurrentHashMap<>();

    /** FINISHED 후 10초 방 정리 Future */
    private volatile ScheduledFuture<?> closeRoomFuture;

    // ─── 생성자 ───────────────────────────────────────────────────────────────

    public MinesweeperBattleRoom(String roomId) {
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

        /** 자발적 이탈 여부 (LEAVE 메시지 or 명시 이탈) — true 이면 전적 미가산 */
        private volatile boolean voluntaryLeft;

        /** BOARD_CLEAR/MINE_HIT 메시지 도달 시 기록된 서버 타임스탬프 (ms) */
        private volatile long finishedAtMillis;

        /** 클라이언트 보고 경과 ms (표시용) */
        private volatile long reportedElapsedMs;

        /** 클리어 또는 지뢰 종료 사유 */
        private volatile String endReason;

        /** 게임 진행률 */
        private volatile int revealedCount;
        private volatile int progressPercent;

        /** 승자 여부 (finishGame 에서 설정) */
        private volatile boolean winner;

        public PlayerInfo(String playerId, String nickname, boolean guest, Long userId) {
            this.playerId = playerId;
            this.nickname = nickname;
            this.guest = guest;
            this.userId = userId;
            this.connected = false;
            this.disconnected = false;
            this.voluntaryLeft = false;
            this.finishedAtMillis = 0L;
            this.reportedElapsedMs = -1L;
            this.endReason = null;
            this.revealedCount = 0;
            this.progressPercent = 0;
            this.winner = false;
        }

        /** 진행률 업데이트 */
        public void updateProgress(int revealedCount, int totalSafeCells) {
            this.revealedCount = revealedCount;
            this.progressPercent = (int) Math.floor((double) revealedCount / totalSafeCells * 100);
        }
    }
}
