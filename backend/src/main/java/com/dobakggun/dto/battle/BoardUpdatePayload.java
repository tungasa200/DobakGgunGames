package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** BOARD_UPDATE payload — 서버가 다른 참가자에게 전파 */
@Getter
@Builder
public class BoardUpdatePayload {
    private String playerId;
    private int[][] board;
    private int score;
    private int lines;
    private int level;
}
