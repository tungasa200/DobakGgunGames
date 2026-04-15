package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 사과게임 세션 시작 응답.
 * board: 서버가 생성한 10×17 보드 (각 셀 값 1~9).
 * 클라이언트는 이 보드를 사용하고 클라이언트 난수 생성을 제거.
 */
@Getter
@Builder
public class AppleSessionStartResponse {
    private String  sessionId;
    private long    startedAt;  // Unix ms
    private long    expiresAt;  // Unix ms
    private int[][] board;      // [rows][cols], values 1~9
}
