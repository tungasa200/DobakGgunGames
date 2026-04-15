package com.dobakggun.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SolitaireMovesBatchResponse {
    private int moves;       // 서버가 집계한 총 이동 수
    private double elapsed;  // 세션 시작 이후 경과 시간 (초)
}
