package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
public class YachtScoreboardDto {

    private Long userId;
    /** key=scoreKey, value=점수(null=미기록) */
    private Map<String, Integer> scores;
    private int upperTotal;
    private boolean bonusEarned;
    private int grandTotal;
}
