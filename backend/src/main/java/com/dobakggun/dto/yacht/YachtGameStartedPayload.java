package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtGameStartedPayload {

    private String roomId;
    private List<Long> turnOrder;
    private Long currentTurnUserId;
    private int rollsLeft;
    private int totalRounds;
}
