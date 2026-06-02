package com.dobakggun.dto.apple;

import lombok.Builder;
import lombok.Getter;

/**
 * 사과게임 배틀 공통 WS envelope (서버 → 클라이언트).
 *
 * <pre>
 * {
 *   "type": "MATCH_READY",
 *   "timestamp": "2026-06-02T10:00:00.000Z",
 *   "payload": { ... }
 * }
 * </pre>
 */
@Getter
@Builder
public class WsAppleBattleMessage {

    /** 메시지 타입 (MATCH_READY, GAME_STARTED, APPLE_REMOVED, GAME_RESULT, ...) */
    private String type;

    /** 서버 전송 시각 ISO8601 */
    private String timestamp;

    /** 타입별 페이로드 */
    private Object payload;
}
