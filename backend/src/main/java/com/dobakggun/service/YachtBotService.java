package com.dobakggun.service;

import com.dobakggun.service.yacht.YachtScoreRules;
import com.dobakggun.service.yacht.YachtScoreRulesFactory;
import com.dobakggun.service.yacht.bot.YachtDpBot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;

/**
 * 야추 봇 실행 서비스.
 *
 * YachtGameService로부터 "봇 턴 시작" 알림을 받아
 * YachtDpBot 알고리즘에 따라 roll → keep → score 액션을 순서대로 수행.
 * 모든 액션은 딜레이를 두어 자연스러운 플레이처럼 보이게 함.
 *
 * D6 전용: D8 룰셋으로 봇 호출 시 UnsupportedOperationException.
 */
@Slf4j
@Service
public class YachtBotService {

    @Value("${yacht.bot.user-id:9999}")
    private long botUserId;

    private static final long TURN_START_DELAY_MS   = 1200;
    private static final long BETWEEN_ROLL_DELAY_MS = 1800;
    private static final long BEFORE_SCORE_DELAY_MS = 1000;

    private final YachtGameService yachtGameService;
    private final YachtDpBot       dpBot;
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "yacht-bot");
                t.setDaemon(true);
                return t;
            });

    public YachtBotService(YachtGameService yachtGameService, YachtDpBot dpBot) {
        this.yachtGameService = yachtGameService;
        this.dpBot            = dpBot;
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
    }

    // ── 공개 API ────────────────────────────────────────────────────────────

    public long getBotUserId() {
        return botUserId;
    }

    public boolean isBot(Long userId) {
        return userId != null && userId == botUserId;
    }

    public void onBotTurnStarted(String roomId) {
        scheduler.schedule(() -> startBotTurn(roomId),
                TURN_START_DELAY_MS, TimeUnit.MILLISECONDS);
    }

    public void autoBotReady(String roomId) {
        yachtGameService.setReady(roomId, botUserId, true);
        log.info("YachtBotService: roomId={} 봇 자동 준비 완료", roomId);
    }

    // ── 턴 실행 ─────────────────────────────────────────────────────────────

    private void startBotTurn(String roomId) {
        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;
        if (!isBot(currentTurnUserId(state))) return;
        doRoll(roomId, List.of());
    }

    private void doRoll(String roomId, List<Integer> keptIndices) {
        String err = yachtGameService.rollDice(roomId, botUserId, keptIndices);
        if (err != null) {
            log.warn("YachtBotService: roll 실패 roomId={} err={}", roomId, err);
            return;
        }

        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;

        int[]           dice      = Arrays.copyOf(state.dice, 5);
        int             rollsLeft = state.rollsLeft;
        YachtScoreRules rules     = YachtScoreRulesFactory.get(state.diceType);

        if (rules.rngFaces() != 6)
            throw new UnsupportedOperationException("Bot only supports D6");

        Map<String, Integer> scored    = state.scoreMap.getOrDefault(botUserId, Map.of());
        int                  filled    = YachtDpBot.computeFilledMaskFromScored(scored);
        int                  upperTotal = computeUpperTotal(state, rules);

        if (rollsLeft > 0) {
            List<Integer> keep = dpBot.decideKeep(dice, rollsLeft, filled, upperTotal);
            if (keep.size() == 5) {
                scheduleScore(roomId, dice, filled, upperTotal);
                return;
            }
            scheduler.schedule(() -> doRoll(roomId, keep),
                    BETWEEN_ROLL_DELAY_MS, TimeUnit.MILLISECONDS);
        } else {
            scheduleScore(roomId, dice, filled, upperTotal);
        }
    }

    private void scheduleScore(String roomId, int[] dice, int filledMask, int upperTotal) {
        scheduler.schedule(() -> {
            String key = dpBot.decideScore(dice, filledMask, upperTotal);
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

    // ── 헬퍼 ────────────────────────────────────────────────────────────────

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
