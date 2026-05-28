package com.dobakggun.dto.minesweeper;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * MINE_HIT 클라이언트 → 서버 요청.
 * 지뢰 클릭으로 즉시 패배 처리.
 */
@Getter
@Setter
@NoArgsConstructor
public class MineHitRequest {
    private long elapsedMs;
    private Map<String, Integer> cell;  // { "r": ..., "c": ... }
}
