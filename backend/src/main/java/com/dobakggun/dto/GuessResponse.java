package com.dobakggun.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class GuessResponse {
    private int strikes;
    private int balls;
    private int attempts;
    private boolean won;
    private boolean gameOver;
    private double elapsed;  // 세션 시작 이후 경과 시간 (초)
    private String answer;   // 게임 오버 시에만 공개 (won=false && gameOver=true)
}
