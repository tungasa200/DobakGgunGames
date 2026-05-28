package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * GAME_RESULT WebSocket 페이로드.
 * 발송 채널: /topic/minesweeper-battle/room/{roomId} (양쪽 모두)
 */
@Getter
@Builder
public class GameResultPayload {

    private String roomId;
    private String winnerId;

    /**
     * 승부 결정 사유.
     * BOARD_CLEAR | MINE_HIT | OPPONENT_DISCONNECT | OPPONENT_LEAVE | FIRST_CLICK_TIMEOUT
     */
    private String reason;

    private List<ResultEntry> results;
    private String finishedAt;  // ISO8601

    @Getter
    @Builder
    public static class ResultEntry {
        private String playerId;
        private String nickname;
        private boolean isGuest;

        /** WIN | LOSE */
        private String outcome;

        /** 클라이언트 보고 경과 ms (표시용). -1 이면 미보고. */
        private long elapsedMs;

        /** 소수점 2자리 초 (표시용) */
        private double elapsedSeconds;

        /**
         * 각자 종료 사유.
         * CLEAR | MINE | DISCONNECT | LEAVE | TIMEOUT | OPPONENT_FORFEIT
         */
        private String endReason;
    }
}
