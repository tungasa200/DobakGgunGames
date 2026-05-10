package com.dobakggun.service.yacht;

import java.util.Set;

/**
 * 야추 점수 룰셋 Strategy 인터페이스.
 * D6Rules (정육면체) / D8Rules (정팔면체) 두 구현이 존재한다.
 */
public interface YachtScoreRules {

    /** 이 룰셋에서 유효한 모든 scoreKey 집합 (D6: 12개, D8: 14개) */
    Set<String> validScoreKeys();

    /** 상단 족보 key 집합 (D6: ONES~SIXES 6개, D8: ONES~EIGHTS 8개) */
    Set<String> upperKeys();

    /** 상단 보너스 임계값 (D6: 63, D8: 84) */
    int upperBonusThreshold();

    /** 상단 보너스 점수 (양 모드 공통 35) */
    int upperBonusValue();

    /** 총 족보 수 (D6: 12, D8: 14) */
    int totalScoreKeys();

    /** 주사위 면 수 (D6: 6, D8: 8) */
    int rngFaces();

    /**
     * scoreKey에 따른 점수 계산.
     * @param scoreKey 족보 키
     * @param dice 서버가 생성한 5개 주사위 배열
     * @return 계산된 점수
     * @throws IllegalArgumentException 룰셋 상 유효하지 않은 scoreKey
     */
    int calculateScore(String scoreKey, int[] dice);
}
