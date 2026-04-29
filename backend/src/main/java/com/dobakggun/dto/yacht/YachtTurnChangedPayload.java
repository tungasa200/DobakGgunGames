package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtTurnChangedPayload {

    private Long previousTurnUserId;
    private Long currentTurnUserId;
    private int roundIndex;
}
