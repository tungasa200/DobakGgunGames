package com.dobakggun.dto.battle;

import lombok.Builder;
import lombok.Getter;

/** MATCH_COUNTDOWN / MATCH_COUNTDOWN_CANCELLED payload */
@Getter
@Builder
public class MatchCountdownPayload {
    /** 남은 초 (MATCH_COUNTDOWN 에서 사용). MATCH_COUNTDOWN_CANCELLED 는 0 또는 미사용. */
    private int seconds;
}
