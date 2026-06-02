package com.dobakggun.dto.apple;

import lombok.Builder;
import lombok.Getter;

/**
 * POST /api/apple-battle/join 응답 DTO.
 */
@Getter
@Builder
public class AppleBattleJoinResponse {

    private String roomId;
    private String playerId;
    private boolean isGuest;
    private String guestToken;
    private String status;          // "WAITING" | "MATCHED"
    private int playerCount;
    private int maxPlayers;

    /** 2번째 플레이어 입장 시점에만 채워짐 (1번째 대기 중은 null) */
    private String opponentNickname;
}
