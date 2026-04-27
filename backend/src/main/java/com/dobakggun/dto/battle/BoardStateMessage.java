package com.dobakggun.dto.battle;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 클라이언트 → 서버 BOARD_STATE 메시지 (200ms 주기).
 * 발행 경로: /app/blockfall-battle/room/{roomId}/board-state
 */
@Getter
@Setter
@NoArgsConstructor
public class BoardStateMessage {
    private String type;
    private int[][] board;
    private int score;
    private int lines;
    private int level;
    private int combo;
}
