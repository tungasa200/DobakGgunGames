package com.dobakggun.service;

import com.dobakggun.entity.rps.RpsChoice;
import com.dobakggun.entity.rps.RpsResult;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * RPS 게임 판정 로직 전담 서비스.
 * 상태를 가지지 않으므로 여러 스레드에서 안전하게 공유 가능.
 */
@Service
public class RpsGameService {

    /**
     * 카드 종류 수 기반 다인 판정.
     *
     * - kinds == 1: 전원 같은 카드 → 전원 DRAW
     * - kinds == 3: 세 종류 모두 → 상성 루프 → 전원 DRAW
     * - kinds == 2: 이기는 카드 낸 사람 WIN, 진 카드 낸 사람 LOSS
     *
     * @param choices userId → 선택 맵 (비어 있으면 안 됨)
     * @return userId → 결과 맵
     */
    public Map<Long, RpsResult> judge(Map<Long, RpsChoice> choices) {
        if (choices == null || choices.isEmpty()) {
            throw new IllegalArgumentException("choices 가 비어 있습니다.");
        }

        Set<RpsChoice> kinds = new java.util.HashSet<>(choices.values());
        Map<Long, RpsResult> results = new java.util.HashMap<>();

        if (kinds.size() == 1 || kinds.size() == 3) {
            // 전원 DRAW
            choices.forEach((userId, choice) -> results.put(userId, RpsResult.DRAW));
            return results;
        }

        // kinds.size() == 2: 두 종류만 나왔을 때 승자 카드 결정
        RpsChoice winnerChoice = determineWinnerChoice(kinds);
        choices.forEach((userId, choice) -> {
            if (choice == winnerChoice) {
                results.put(userId, RpsResult.WIN);
            } else {
                results.put(userId, RpsResult.LOSS);
            }
        });
        return results;
    }

    /**
     * 두 종류 카드 중 이기는 카드를 반환.
     * ROCK beats SCISSORS, SCISSORS beats PAPER, PAPER beats ROCK
     */
    private RpsChoice determineWinnerChoice(Set<RpsChoice> kinds) {
        RpsChoice[] arr = kinds.toArray(new RpsChoice[0]);
        RpsChoice a = arr[0];
        RpsChoice b = arr[1];

        return beats(a, b) ? a : b;
    }

    /**
     * a 가 b 를 이기면 true.
     */
    public boolean beats(RpsChoice a, RpsChoice b) {
        return switch (a) {
            case ROCK     -> b == RpsChoice.SCISSORS;
            case SCISSORS -> b == RpsChoice.PAPER;
            case PAPER    -> b == RpsChoice.ROCK;
        };
    }

    /**
     * 1:1 판정 헬퍼 (단위 테스트 등에서 활용).
     */
    public RpsResult judgeOne(RpsChoice userChoice, RpsChoice opponentChoice) {
        if (userChoice == opponentChoice) return RpsResult.DRAW;
        return beats(userChoice, opponentChoice) ? RpsResult.WIN : RpsResult.LOSS;
    }
}
