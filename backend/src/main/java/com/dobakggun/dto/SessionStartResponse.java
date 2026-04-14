package com.dobakggun.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SessionStartResponse {
    private String sessionId;
    private long startedAt;   // Unix ms
    private long expiresAt;   // Unix ms
}
