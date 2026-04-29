package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtMatchResponse {

    private String roomId;
    private String status;
    private int playerCount;
    private int maxPlayers;
    private boolean created;
    /** PLAYING 방에 합류한 관전자로 입장한 경우 true. WAITING 합류/신규 방 생성은 false. */
    private boolean joinedAsSpectator;
}
