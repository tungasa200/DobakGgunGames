package com.dobakggun.service;

import com.dobakggun.service.yacht.YachtScoreRules;
import com.dobakggun.service.yacht.YachtScoreRulesFactory;
import com.dobakggun.service.yacht.bot.YachtDpBot;
import com.dobakggun.service.yacht.bot.YachtDpContext;
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
 * YachtDpBot 알고리즘에 따라 roll → keep → score 액션을 순서대로 수행.
 * 모든 액션은 딜레이를 두어 자연스러운 플레이처럼 보이게 함.
 *
 * D6/D8 공통 지원: diceType으로 YachtDpContext를 결정해 DP 봇에 전달.
 */
@Slf4j
@Service
public class YachtBotService {

    @Value("${yacht.bot.user-id:9999}")
    private long botUserId;

    private static final long TURN_START_DELAY_MS   = 1200;
    private static final long BETWEEN_ROLL_DELAY_MS = 1800;
    private static final long BEFORE_SCORE_DELAY_MS = 1000;

    /** W 테이블 미준비 시 최대 재시도 횟수 (3 × 3s = 9초) */
    private static final int  MAX_TABLE_WAIT_RETRIES = 3;
    private static final long TABLE_RETRY_MS         = 3_000;

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
        scheduler.schedule(() -> startBotTurn(roomId, 0),
                TURN_START_DELAY_MS, TimeUnit.MILLISECONDS);
    }

    public void autoBotReady(String roomId) {
        yachtGameService.setReady(roomId, botUserId, true);
        log.info("YachtBotService: roomId={} 봇 자동 준비 완료", roomId);
    }

    // ── 턴 실행 ─────────────────────────────────────────────────────────────

    private void startBotTurn(String roomId, int retryCount) {
        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;
        if (!isBot(currentTurnUserId(state))) return;

        YachtScoreRules rules = YachtScoreRulesFactory.get(state.diceType);
        YachtDpContext  ctx   = rules.rngFaces() == 6 ? YachtDpContext.D6 : YachtDpContext.D8;

        if (!dpBot.isReady(ctx)) {
            if (retryCount < MAX_TABLE_WAIT_RETRIES) {
                log.info("YachtBotService: W 테이블 미준비 ({}) [{}/{}] — {}ms 후 재시도 roomId={}",
                        ctx.binFileName, retryCount + 1, MAX_TABLE_WAIT_RETRIES, TABLE_RETRY_MS, roomId);
                scheduler.schedule(() -> startBotTurn(roomId, retryCount + 1),
                        TABLE_RETRY_MS, TimeUnit.MILLISECONDS);
            } else {
                log.warn("YachtBotService: W 테이블 타임아웃 — 폴백 전략으로 턴 진행 roomId={}", roomId);
                doFallbackTurn(roomId, rules);
            }
            return;
        }
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
        YachtDpContext  ctx       = rules.rngFaces() == 6 ? YachtDpContext.D6 : YachtDpContext.D8;

        Map<String, Integer> scored    = state.scoreMap.getOrDefault(botUserId, Map.of());
        int                  filled    = YachtDpBot.computeFilledMaskFromScored(ctx, scored);
        int                  upperTotal = Math.min(ctx.upperCap, computeUpperTotal(state, rules));

        if (rollsLeft > 0) {
            List<Integer> keep = dpBot.decideKeep(ctx, dice, rollsLeft, filled, upperTotal);
            if (keep.size() == 5) {
                scheduleScore(ctx, roomId, dice, filled, upperTotal);
                return;
            }
            scheduler.schedule(() -> doRoll(roomId, keep),
                    BETWEEN_ROLL_DELAY_MS, TimeUnit.MILLISECONDS);
        } else {
            scheduleScore(ctx, roomId, dice, filled, upperTotal);
        }
    }

    private void scheduleScore(YachtDpContext ctx, String roomId, int[] dice,
                                int filledMask, int upperTotal) {
        scheduler.schedule(() -> {
            String key = dpBot.decideScore(ctx, dice, filledMask, upperTotal);
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

    // ── 폴백 (W 테이블 미준비 시) ────────────────────────────────────────────

    private void doFallbackTurn(String roomId, YachtScoreRules rules) {
        String err = yachtGameService.rollDice(roomId, botUserId, List.of());
        if (err != null) {
            log.warn("YachtBotService: 폴백 roll 실패 roomId={} err={}", roomId, err);
            return;
        }
        YachtGameService.YachtRoomState state = yachtGameService.getState(roomId);
        if (state == null) return;
        int[]                dice   = Arrays.copyOf(state.dice, 5);
        Map<String, Integer> scored = state.scoreMap.getOrDefault(botUserId, Map.of());
        scheduleFallbackScore(rules, roomId, dice, scored);
    }

    private void scheduleFallbackScore(YachtScoreRules rules, String roomId,
                                        int[] dice, Map<String, Integer> scored) {
        scheduler.schedule(() -> {
            Set<String> available = rules.validScoreKeys().stream()
                    .filter(k -> !scored.containsKey(k))
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            if (available.isEmpty()) {
                log.error("YachtBotService: 폴백 — 사용 가능한 슬롯 없음 roomId={}", roomId);
                return;
            }
            String best = available.stream()
                    .max(Comparator.comparingInt(k -> rules.calculateScore(k, dice)))
                    .orElse(available.iterator().next());
            log.info("YachtBotService: 폴백 점수 선택 key={} score={} roomId={}",
                    best, rules.calculateScore(best, dice), roomId);
            String err = yachtGameService.recordScore(roomId, botUserId, best);
            if (err != null) {
                log.warn("YachtBotService: 폴백 score 실패 roomId={} key={} err={}", roomId, best, err);
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
