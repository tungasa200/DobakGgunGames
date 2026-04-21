package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SudokuSessionStartResponse {
    private final String sessionId;
    private final long   startedAt;
    private final long   expiresAt;
    private final int[][] puzzle;
    private final int[][] solution;
}
