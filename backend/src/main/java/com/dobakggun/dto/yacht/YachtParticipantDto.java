package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtParticipantDto {

    private Long userId;
    private String nickname;
    private boolean ready;
    private boolean isHost;
    /** 게임 중 합류한 관전자 (turnOrder에 없음). WAITING/FINISHED에서는 false. */
    private boolean isSpectator;
}
