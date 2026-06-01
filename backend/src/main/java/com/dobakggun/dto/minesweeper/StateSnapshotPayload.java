package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * STATE_SNAPSHOT WebSocket 페이로드.
 * 발송 채널: /user/queue/minesweeper-battle/state (요청자 개인 큐)
 * 재연결 후 REQUEST_STATE 에 대한 응답.
 */
@Getter
@Builder
public class StateSnapshotPayload {

    private String roomId;

    /** 현재 방 상태 — WAITING | MATCH_READY | PLAYING | FINISHED */
    private String roomStatus;

    private List<PlayerEntry> players;

    /** adjMines — PLAYING 상태인 경우만 채워짐. MATCH_READY 상태이면 null. */
    private int[][] adjMines;

    /** 게임 시작 시각 ms — PLAYING 상태인 경우만 유효 */
    private long serverStartAtMillis;

    /** 본인의 FIRST_CLICK 수신 여부 */
    private boolean myFirstClickConfirmed;

    /** 상대의 FIRST_CLICK 수신 여부 */
    private boolean opponentFirstClickConfirmed;

    private ProgressEntry myProgress;
    private ProgressEntry opponentProgress;

    /** 보드 크기 및 난이도 정보 */
    private int rows;
    private int cols;
    private int totalSafeCells;
    private String difficulty;

    @Getter
    @Builder
    public static class PlayerEntry {
        private String playerId;
        private String nickname;
        private boolean isGuest;
    }

    @Getter
    @Builder
    public static class ProgressEntry {
        private int revealedCount;
        private int progressPercent;
    }
}
