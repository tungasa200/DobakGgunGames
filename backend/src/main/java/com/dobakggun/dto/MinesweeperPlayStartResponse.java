package com.dobakggun.dto;

import com.dobakggun.dto.MinesweeperRevealResponse.RevealedCell;

import java.util.List;

/** protocol 2 시작 응답. 첫 클릭으로 열린 칸만 포함하고 미오픈 칸 정보는 없다. */
public record MinesweeperPlayStartResponse(
    String sessionId,
    long startedAt,
    long expiresAt,
    int rows,
    int cols,
    int mines,
    String status,
    List<RevealedCell> revealed
) {}
