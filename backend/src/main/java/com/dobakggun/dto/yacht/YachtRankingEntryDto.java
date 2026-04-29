package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtRankingEntryDto {

    private int rank;
    private Long userId;
    private String nickname;
    private int totalScore;
    private boolean isWinner;
}
