package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

/**
 * 서버 → 클라이언트 STOMP 메시지 공통 봉투.
 * { "type": "...", "timestamp": "...", "payload": {...} }
 */
@Getter
@Builder
public class YachtEnvelopeDto {

    private String type;
    private String timestamp;
    private Object payload;
}
