package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/**
 * 서버 → 클라이언트 공통 메시지 봉투.
 * { "type": "...", "timestamp": "ISO8601", "payload": { ... } }
 */
@Getter
@Builder
public class BattleEnvelope {
    private String type;
    private String timestamp;
    private Object payload;
}
