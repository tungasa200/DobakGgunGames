package com.dobakggun.dto;

import java.util.List;

/** mines는 LOST에서만, clearTimeMs는 WON에서만 값이 있다. */
public record MinesweeperRevealResponse(
    String status,
    List<RevealedCell> revealed,
    int[][] mines,
    Long clearTimeMs
) {
    public record RevealedCell(int r, int c, int n) {}
}
