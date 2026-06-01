package com.dobakggun.dto.minesweeper;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

/**
 * POST /api/minesweeper-battle/join 응답 DTO.
 */
@Getter
@Builder
public class MinesweeperBattleJoinResponse {

    private String roomId;
    private String playerId;
    private boolean isGuest;
    private String guestToken;
    private String status;          // "WAITING" | "MATCH_READY"
    private int playerCount;
    private int maxPlayers;

    /** 지정 시작 셀 좌표 (난이도에 따라 다름) */
    private Map<String, Integer> designatedCell;

    /** 2번째 플레이어 입장 시점에만 채워짐 (1번째 대기 중은 null) */
    private String opponentNickname;

    /** 게임 난이도 — "BEGINNER" | "INTERMEDIATE" */
    private String difficulty;

    /** 보드 행/열/안전 셀 수 */
    private int rows;
    private int cols;
    private int totalSafeCells;
}
