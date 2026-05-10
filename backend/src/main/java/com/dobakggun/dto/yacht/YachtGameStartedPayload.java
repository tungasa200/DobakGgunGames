package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtGameStartedPayload {

    private String roomId;
    /** D6 또는 D8. 클라이언트가 점수판 키 셋(12/14)과 보너스 임계(63/84)를 결정. */
    private String diceType;
    private List<Long> turnOrder;
    private Long currentTurnUserId;
    private int rollsLeft;
    /** 참가자수 × totalScoreKeys (D6: ×12, D8: ×14). */
    private int totalRounds;
}
