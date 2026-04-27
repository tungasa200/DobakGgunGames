package com.dobakggun.dto.battle;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

/**
 * 방 참가자 정보 (payload 내 공통 사용).
 */
@Getter
@Builder
public class PlayerInfo {
    private String id;
    private String nickname;
    @JsonProperty("isGuest")
    private boolean isGuest;
}
