package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YachtGameOverPayload {

    private String roomId;
    private List<YachtRankingEntryDto> rankings;
    private List<Long> winnerUserIds;
}
