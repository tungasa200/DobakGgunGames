package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtScoreRecordedPayload {

    private Long userId;
    private String scoreKey;
    private int score;
    private int upperTotal;
    private boolean bonusEarned;
    private int grandTotal;
}
