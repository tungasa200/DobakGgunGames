package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 지뢰찾기 세션 시작 응답.
 * adjMines: -1 = 지뢰 셀, 0~8 = 인접 지뢰 수
 */
@Getter
@Builder
public class MinesweeperSessionStartResponse {
    private String sessionId;
    private long   startedAt;   // Unix ms
    private long   expiresAt;   // Unix ms
    private int[][] adjMines;   // [rows][cols], -1 = mine
}
