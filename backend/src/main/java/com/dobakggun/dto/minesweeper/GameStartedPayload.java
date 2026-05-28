package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

/**
 * GAME_STARTED WebSocket 페이로드.
 * 발송 채널: /user/queue/minesweeper-battle/board (개인 큐)
 *
 * 보안 주의: adjMines 만 포함. 지뢰 좌표 배열은 절대 포함 금지 (§11.3).
 * adjMines: -1=지뢰, 0~8=인접 지뢰 수.
 */
@Getter
@Builder
public class GameStartedPayload {

    private String roomId;
    private String playerId;

    /**
     * adjMines[9][9] — -1=지뢰, 0~8=인접 지뢰 수.
     * 지뢰 좌표를 별도 배열로 노출하지 않는다.
     */
    private int[][] adjMines;

    /** 서버 기준 시작 시각 ISO8601 (감사용) */
    private String serverStartAt;

    /** 클라이언트 타이머 계산 보조 (ms) */
    private long serverStartAtMillis;
}
