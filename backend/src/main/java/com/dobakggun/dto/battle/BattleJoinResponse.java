package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class BattleJoinResponse {
    private String roomId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    /** 즉시 참가 시 null, 큐 진입 시 1부터 시작 */
    private Integer queuePosition;
    private boolean isGuest;
    /** 게스트 신규 발급 시 토큰, 로그인 유저는 null */
    private String guestToken;
    /** 본인 플레이어 ID (user_id 의 string 또는 guest_{uuid}) */
    private String playerId;
}
