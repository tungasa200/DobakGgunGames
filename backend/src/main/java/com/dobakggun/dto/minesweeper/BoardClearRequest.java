package com.dobakggun.dto.minesweeper;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * BOARD_CLEAR 클라이언트 → 서버 요청.
 * elapsedMs 는 표시용 — 승패 판정은 서버 도달 시점 기준.
 */
@Getter
@Setter
@NoArgsConstructor
public class BoardClearRequest {
    private long elapsedMs;
}
