package com.dobakggun.dto.rsp;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class RspStatsResponse {

    private long totalPlays;
    private long wins;
    private long losses;
    private long draws;

    /** 0~1 범위, 소수점 4자리 반올림. totalPlays=0이면 null */
    private BigDecimal winRate;
}
