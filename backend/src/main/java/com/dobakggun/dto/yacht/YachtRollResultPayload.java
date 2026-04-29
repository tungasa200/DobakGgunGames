package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtRollResultPayload {

    private Long currentTurnUserId;
    private int[] dice;
    private List<Integer> keptIndices;
    private int rollsLeft;
}
