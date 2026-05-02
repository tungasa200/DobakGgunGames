package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/**
 * MY_GAME_STATE payload — 새로고침/재연결한 본인에게만 전송.
 * 서버가 마지막으로 수신한 BOARD_UPDATE 스냅샷을 그대로 돌려준다.
 * (HOLD/7-bag/nextQueue 는 클라이언트 sessionStorage 에서 별도 복원)
 */
@Getter
@Builder
public class MyGameStatePayload {
    private String playerId;
    private int[][] board;
    private int score;
    private int lines;
    private int level;
    private int combo;
}
