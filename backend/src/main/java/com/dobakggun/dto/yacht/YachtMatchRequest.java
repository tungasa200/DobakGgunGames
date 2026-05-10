package com.dobakggun.dto.yacht;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * POST /api/yacht/match 요청 바디.
 * diceType: "D6" | "D8" — 필수. 누락 또는 잘못된 값 → 400 INVALID_DICE_TYPE.
 */
@Getter
@NoArgsConstructor
public class YachtMatchRequest {

    /** "D6" 또는 "D8". 대소문자 구분. */
    private String diceType;
}
