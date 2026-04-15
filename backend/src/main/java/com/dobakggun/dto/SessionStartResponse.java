package com.dobakggun.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SessionStartResponse {
    private String sessionId;
    private long startedAt;    // Unix ms
    private long expiresAt;    // Unix ms
    private Integer digitCount; // 숫자야구 전용 (다른 게임은 null)
}
