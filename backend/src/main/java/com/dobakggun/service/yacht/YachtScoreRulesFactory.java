package com.dobakggun.service.yacht;

import com.dobakggun.entity.yacht.YachtDiceType;

/**
 * YachtDiceType → YachtScoreRules 매핑 팩토리.
 */
public final class YachtScoreRulesFactory {

    private static final YachtScoreRules D6 = new D6Rules();
    private static final YachtScoreRules D8 = new D8Rules();

    private YachtScoreRulesFactory() {}

    public static YachtScoreRules get(YachtDiceType diceType) {
        return switch (diceType) {
            case D6 -> D6;
            case D8 -> D8;
        };
    }
}
