package com.dobakggun.dto;

import com.dobakggun.dto.MinesweeperRevealResponse.RevealedCell;

import java.util.List;

/** revealed는 지금까지 열린 칸 전체다. mines는 LOST에서만, clearTimeMs는 WON에서만 값이 있다. */
public record MinesweeperStateResponse(
    String status,
    int rows,
    int cols,
    int mineCount,
    long startedAt,
    long expiresAt,
    List<RevealedCell> revealed,
    int[][] mines,
    Long clearTimeMs
) {}
