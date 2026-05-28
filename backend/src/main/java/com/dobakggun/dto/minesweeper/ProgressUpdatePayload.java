package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

/**
 * PROGRESS_UPDATE WebSocket 페이로드.
 * 발송 채널: /topic/minesweeper-battle/room/{roomId} (브로드캐스트)
 * 클라이언트가 자기 자신의 playerId 와 일치하면 무시.
 */
@Getter
@Builder
public class ProgressUpdatePayload {

    private String playerId;
    private int revealedCount;
    private int totalSafeCells;   // 항상 71
    private int progressPercent;  // floor(revealedCount / 71 * 100)
}
