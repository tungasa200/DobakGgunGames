package com.dobakggun.service;

import com.dobakggun.service.yacht.YachtBotStrategy;
import com.dobakggun.service.yacht.YachtScoreRules;
import com.dobakggun.service.yacht.YachtScoreRulesFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * 야추 봇 실행 서비스.
 *
 * YachtGameService로부터 "봇 턴 시작" 알림을 받아
 * YachtBotStrategy 알고리즘에 따라 roll → keep → score 액션을 순서대로 수행.
 * 모든 액션은 딜레이를 두어 자연스러운 플레이처럼 보이게 함.
 */
@Slf4j
@Service
public class YachtBotService {

    /** 봇 유저 ID (application.properties: yacht.bot.user-id). 기본값 9999. */
    @Value("${yacht.bot.user-id:9999}")
    private long botUserId;

    private static final long TURN_START_DELAY_MS   = 1200;
    private static final long BETWEEN_ROLL_DELAY_MS = 1800;
    private static final long BEFORE_SCORE_DELAY_MS = 1000;

    private final YachtGameService yachtGameService;
    private final YachtBotStrategy strategy = new YachtBotStrategy();
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "yacht-bot");
                t.setDaemon(true);
                return t;
            });

    public YachtBotService(YachtGameService yachtGameService) {
        this.yachtGameService = yachtGameService;
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
    }

    // ─── 공개 API ────────────────────────────────────────────────────────────

    public long getBotUserId() {
        return botUserId;
    }

    public boolean isBot(Long userId) {
        return userId != null && userId == botUserId;
    }

    /**
     * 봇의 턴이 되었을 때 YachtGameService에서 호출.
     * TURN_START_DELAY 후 첫 굴림 시작.
     */
    public void onBotTurnStarted(String roomId) {
        scheduler.schedule(() -> startBotTurn(roomId),
                TURN_START_DELAY_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * 봇을 특정 방에 자동 준비 상태로 만듦 (joinRoom 직후 호출).
     */
    public void autoBotReady(String roomId) {
        yachtGameService.setReady(roomId, botUserId, true);
        log.info("YachtBotService: roomId={} 봇 자동 준비 완료", roomId);
    }

    // ─── 턴 실행 ─────────────────────────────────────────────────────────────

    private void startBotTurn(String roomId) {
        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;
        if (!isBot(currentTurnUserId(state))) return;

        doRoll(roomId, List.of());
    }

    /** 굴림 수행 후 keep 결정 → 재굴림 or 점수 기록 스케줄 */
    private void doRoll(String roomId, List<Integer> keptIndices) {
        String err = yachtGameService.rollDice(roomId, botUserId, keptIndices);
        if (err != null) {
            log.warn("YachtBotService: roll 실패 roomId={} err={}", roomId, err);
            return;
        }

        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;

        int[]           dice            = Arrays.copyOf(state.dice, 5);
        int             rollsLeft       = state.rollsLeft;
        YachtScoreRules rules           = YachtScoreRulesFactory.get(state.diceType);
        Set<String>     remaining       = remainingKeys(state);
        int             upperTotal      = computeUpperTotal(state, rules);

        if (rollsLeft > 0) {
            List<Integer> keep = strategy.decideKeep(dice, remaining, rules,
                                                      rollsLeft, upperTotal);
            // DP가 mask=11111을 선택하면 keep.size()==5 → 조기 종료
            if (keep.size() == 5) {
                scheduleScore(roomId, dice, remaining, rules, upperTotal);
                return;
            }

            scheduler.schedule(() -> doRoll(roomId, keep),
                    BETWEEN_ROLL_DELAY_MS, TimeUnit.MILLISECONDS);
        } else {
            scheduleScore(roomId, dice, remaining, rules, upperTotal);
        }
    }

    private void scheduleScore(String roomId, int[] dice, Set<String> remaining,
                                YachtScoreRules rules, int upperTotal) {
        scheduler.schedule(() -> {
            String key = strategy.decideScore(dice, remaining, rules, upperTotal);
            if (key == null) {
                log.error("YachtBotService: decideScore returned null roomId={}", roomId);
                return;
            }
            String err = yachtGameService.recordScore(roomId, botUserId, key);
            if (err != null) {
                log.warn("YachtBotService: score 실패 roomId={} key={} err={}", roomId, key, err);
            }
        }, BEFORE_SCORE_DELAY_MS, TimeUnit.MILLISECONDS);
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────

    private Set<String> remainingKeys(YachtGameService.YachtRoomState state) {
        YachtScoreRules      rules  = YachtScoreRulesFactory.get(state.diceType);
        Map<String, Integer> scored = state.scoreMap.getOrDefault(botUserId, Map.of());
        return rules.validScoreKeys().stream()
                .filter(k -> !scored.containsKey(k))
                .collect(Collectors.toSet());
    }

    private int computeUpperTotal(YachtGameService.YachtRoomState state, YachtScoreRules rules) {
        Map<String, Integer> scored = state.scoreMap.getOrDefault(botUserId, Map.of());
        return rules.upperKeys().stream()
                .mapToInt(k -> scored.getOrDefault(k, 0))
                .sum();
    }

    private static Long currentTurnUserId(YachtGameService.YachtRoomState state) {
        if (state.turnOrder == null || state.turnOrder.isEmpty()) return null;
        return state.turnOrder.get(state.turnOrderIndex % state.turnOrder.size());
    }
}
