package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtMatchResponse {

    private String roomId;
    private String status;
    /** D6 또는 D8. d8 모드 도입 이후 항상 포함. */
    private String diceType;
    private int playerCount;
    private int maxPlayers;
    private boolean created;
    /** PLAYING 방에 합류한 관전자로 입장한 경우 true. WAITING 합류/신규 방 생성은 false. */
    private boolean joinedAsSpectator;
}
