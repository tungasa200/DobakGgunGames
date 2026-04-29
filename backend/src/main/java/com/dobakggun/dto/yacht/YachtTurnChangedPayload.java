package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtTurnChangedPayload {

    private Long previousTurnUserId;
    private Long currentTurnUserId;
    private int rollsLeft;
    /** 1-based 라운드 번호 (1~12) */
    private int roundNum;
}
