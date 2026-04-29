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
}
