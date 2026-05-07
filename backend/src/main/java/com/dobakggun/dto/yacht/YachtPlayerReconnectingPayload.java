package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtPlayerReconnectingPayload {
    private Long userId;
    private String nickname;
}
