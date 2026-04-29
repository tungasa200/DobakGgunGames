package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtTurnStatePayload {

    private Long currentTurnUserId;
    private int rollsLeft;
    /** 0=미굴림. 첫 TURN_STATE는 [0,0,0,0,0]. */
    private int[] dice;
    private List<Integer> keptIndices;
    /** 0-based 라운드 인덱스 */
    private int roundIndex;
}
