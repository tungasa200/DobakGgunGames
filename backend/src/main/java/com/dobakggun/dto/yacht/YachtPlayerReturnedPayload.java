package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtPlayerReturnedPayload {
    private Long userId;
    private String nickname;
}
