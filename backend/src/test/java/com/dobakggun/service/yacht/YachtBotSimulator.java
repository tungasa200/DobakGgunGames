package com.dobakggun.service.yacht;

import com.dobakggun.service.yacht.bot.YachtDpBot;
import com.dobakggun.service.yacht.bot.YachtDpContext;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;

/**
 * YachtDpBot Paired-Sampling 시뮬레이터.
 *
 * 실행: ./gradlew test --tests "*YachtBotSimulator*"
 * D6만: ./gradlew test --tests "*YachtBotSimulator.compareD6"
 * D8만: ./gradlew test --tests "*YachtBotSimulator.compareD8"
 *
 * ── Paired sampling ──────────────────────────────────────────────────────────
 * 베이스라인·DP봇이 동일한 dice tape를 소비 → 공통 분산 제거.
 *
 * ── Auto-scale ───────────────────────────────────────────────────────────────
 * |paired-t| < SIG_THRESHOLD → 게임 수 4배 증가 (GAMES_MAX 상한).
 *
 * ── Phase 통계 ───────────────────────────────────────────────────────────────
 *   bonusCount     : 상단 보너스 달성 게임 수
 *   yacht0Count    : YACHT 슬롯을 0점으로 기록한 게임 수
 *   choiceLateCount: 남은 슬롯 ≤ 4일 때 CHOICE를 기록한 게임 수
 */
public class YachtBotSimulator {

    private static final int    GAMES_INITIAL = 200;
    private static final int    GAMES_MAX     = 10_000;
    private static final double SIG_THRESHOLD = 2.0;

    // ─── 전략 인터페이스 ─────────────────────────────────────────────────────

    private interface SimBot {
        List<Integer> decideKeep(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                                  YachtScoreRules rules, int rollsLeft);
        String decideScore(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                           YachtScoreRules rules);
    }

    // ─── 베이스라인 (1-step brute-force EV, 구 알고리즘) ─────────────────────

    private static final class BaselineBot implements SimBot {

        private static final Map<String, Double> COST = Map.ofEntries(
                Map.entry("ONES", 3.0),   Map.entry("TWOS", 6.0),    Map.entry("THREES", 9.0),
                Map.entry("FOURS", 12.0), Map.entry("FIVES", 15.0),  Map.entry("SIXES", 18.0),
                Map.entry("SEVENS", 21.0), Map.entry("EIGHTS", 24.0),
                Map.entry("CHOICE", 17.5),         Map.entry("FOUR_OF_A_KIND", 9.5),
                Map.entry("FULL_HOUSE", 9.2),      Map.entry("LITTLE_STRAIGHT", 8.6),
                Map.entry("BIG_STRAIGHT", 13.6),   Map.entry("YACHT", 6.0));

        @Override
        public List<Integer> decideKeep(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                                         YachtScoreRules rules, int rollsLeft) {
            Set<String> remaining = maskToRemaining(ctx, filledMask);
            if (remaining.isEmpty()) return ALL;
            int bestMask = 31; double bestEv = -1.0;
            for (int mask = 0; mask < 32; mask++) {
                double ev = oneStepEv(dice, mask, remaining, rules);
                if (ev > bestEv) { bestEv = ev; bestMask = mask; }
            }
            return indicesFromMask(bestMask);
        }

        @Override
        public String decideScore(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                                   YachtScoreRules rules) {
            Set<String> remaining = maskToRemaining(ctx, filledMask);
            String bestNZ = null; double bestNet = Double.NEGATIVE_INFINITY; int bestScore = -1;
            String bestZ  = null; double lowestCost = Double.MAX_VALUE;
            for (String key : remaining) {
                int    score = rules.calculateScore(key, dice);
                double cost  = COST.getOrDefault(key, 10.0);
                if (score > 0) {
                    double net = score - cost;
                    if (net > bestNet || (net == bestNet && score > bestScore)) {
                        bestNet = net; bestScore = score; bestNZ = key;
                    }
                } else if (cost < lowestCost) { lowestCost = cost; bestZ = key; }
            }
            return bestNZ != null ? bestNZ : bestZ;
        }

        private static double oneStepEv(int[] dice, int mask, Set<String> remaining,
                                         YachtScoreRules rules) {
            int faces  = rules.rngFaces();
            int reroll = 5 - Integer.bitCount(mask);
            int total  = ipow(faces, reroll);
            double sum = 0;
            for (int combo = 0; combo < total; combo++) {
                int[] result = buildResult(dice, mask, combo, faces);
                double best  = 0;
                for (String k : remaining) {
                    int s = rules.calculateScore(k, result);
                    if (s > best) best = s;
                }
                sum += best;
            }
            return sum / total;
        }

        private static int[] buildResult(int[] dice, int mask, int combo, int faces) {
            int[] r = Arrays.copyOf(dice, 5); int t = combo;
            for (int i = 0; i < 5; i++)
                if ((mask & (1 << i)) == 0) { r[i] = (t % faces) + 1; t /= faces; }
            return r;
        }

        private static Set<String> maskToRemaining(YachtDpContext ctx, int filledMask) {
            Set<String> remaining = new HashSet<>(ctx.rules.validScoreKeys());
            for (int k = 0; k < ctx.numSlots; k++) {
                if ((filledMask & (1 << k)) != 0)
                    remaining.remove(ctx.slotNames[k]);
            }
            return remaining;
        }
    }

    // ─── DP봇 래퍼 ──────────────────────────────────────────────────────────

    private static final class DpBot implements SimBot {
        private final YachtDpBot inner;
        DpBot(YachtDpBot bot) { this.inner = bot; }

        @Override
        public List<Integer> decideKeep(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                                         YachtScoreRules rules, int rollsLeft) {
            return inner.decideKeep(ctx, dice, rollsLeft, filledMask, upperTotal);
        }

        @Override
        public String decideScore(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal,
                                   YachtScoreRules rules) {
            return inner.decideScore(ctx, dice, filledMask, upperTotal);
        }
    }

    // ─── JUnit 진입점 ────────────────────────────────────────────────────────

    @Test
    void compareD6() {
        YachtDpBot dpBot = createAndWaitForBot(YachtDpContext.D6);
        System.out.printf("[D6] DP이론값(W[0][0]) = %.4f%n", dpBot.getWTable(YachtDpContext.D6)[0]);
        compare("D6", YachtDpContext.D6, new D6Rules(), new DpBot(dpBot));
    }

    @Disabled("D8 W 테이블 사전 계산 ~30분 소요 — 수동 실행: ./gradlew test --tests \"*YachtBotSimulator.compareD8\"")
    @Test
    void compareD8() {
        YachtDpBot dpBot = createAndWaitForBot(YachtDpContext.D8);
        System.out.printf("[D8] DP이론값(W[0][0]) = %.4f%n", dpBot.getWTable(YachtDpContext.D8)[0]);
        compare("D8", YachtDpContext.D8, new D8Rules(), new DpBot(dpBot));
    }

    // ─── Paired 비교 ─────────────────────────────────────────────────────────

    private static void compare(String label, YachtDpContext ctx, YachtScoreRules rules, SimBot improved) {
        SimBot baseline = new BaselineBot();
        int games = GAMES_INITIAL;
        PairedResult r;

        do {
            long t0 = System.currentTimeMillis();
            r = runPaired(ctx, baseline, improved, rules, games);
            long elapsed = System.currentTimeMillis() - t0;

            double tStat = r.meanDiff / r.stderrDiff;
            System.out.printf(
                "[%s] n=%,d | baseline=%.2f | dp=%.2f | Δ=+%.2f (95%%CI ±%.2f) | t=%.2f | %.1fs%n",
                label, games,
                r.meanBaseline, r.meanImproved,
                r.meanDiff, 1.96 * r.stderrDiff,
                tStat, elapsed / 1000.0);

            System.out.printf(
                "[%s] dp stats: bonus=%.1f%% | yacht0=%.1f%% | choiceLate=%.1f%%%n",
                label,
                100.0 * r.bonusRate,
                100.0 * r.yacht0Rate,
                100.0 * r.choiceLateRate);

            if (Math.abs(tStat) >= SIG_THRESHOLD || games >= GAMES_MAX) break;

            int next = Math.min(games * 4, GAMES_MAX);
            System.out.printf("[%s] t=%.2f < %.1f → %,d게임으로 재측정%n",
                    label, tStat, SIG_THRESHOLD, next);
            games = next;
        } while (true);

        measureLatency(label, ctx, improved, rules);
    }

    // ─── Paired 실행 (parallelStream) ────────────────────────────────────────

    private static PairedResult runPaired(YachtDpContext ctx, SimBot baseline, SimBot improved,
                                           YachtScoreRules rules, int games) {
        int maxRolls = rules.maxRollsPerTurn();
        int faces    = rules.rngFaces();

        byte[][][][] tapes = pregenerateTapes(games, rules.totalScoreKeys(), maxRolls, faces);

        int[] baselineScores = IntStream.range(0, games).parallel()
                .map(i -> playWithTape(ctx, baseline, rules, tapes[i], maxRolls).score)
                .toArray();

        GameStats[] improvedResults = IntStream.range(0, games).parallel()
                .mapToObj(i -> playWithTape(ctx, improved, rules, tapes[i], maxRolls))
                .toArray(GameStats[]::new);

        double sumB = 0, sumI = 0, sumD = 0, sumD2 = 0;
        long bonusCount = 0, yacht0Count = 0, choiceLateCount = 0;

        for (int i = 0; i < games; i++) {
            double b  = baselineScores[i];
            double iv = improvedResults[i].score;
            double d  = iv - b;
            sumB  += b;   sumI  += iv;
            sumD  += d;   sumD2 += d * d;
            if (improvedResults[i].bonusAchieved)  bonusCount++;
            if (improvedResults[i].yacht0Recorded) yacht0Count++;
            if (improvedResults[i].choiceLate)     choiceLateCount++;
        }

        double meanD  = sumD / games;
        double varD   = sumD2 / games - meanD * meanD;
        double stderr = Math.sqrt(varD / games);

        return new PairedResult(sumB / games, sumI / games, meanD, stderr,
                (double) bonusCount / games,
                (double) yacht0Count / games,
                (double) choiceLateCount / games);
    }

    // ─── 1게임 플레이 ────────────────────────────────────────────────────────

    private static GameStats playWithTape(YachtDpContext ctx, SimBot bot, YachtScoreRules rules,
                                           byte[][][] tape, int maxRolls) {
        int     filledMask  = 0;
        int     upperTotal  = 0;
        int     turn        = 0;
        boolean yacht0      = false;
        boolean choiceLate  = false;
        Map<String, Integer> scored = new HashMap<>();

        while (filledMask != ctx.allFilled) {
            int[] dice = tapeRow(tape[turn][0]);
            int remainingBefore = ctx.numSlots - Integer.bitCount(filledMask);

            for (int r = 1; r < maxRolls; r++) {
                int           rollsLeft = maxRolls - r;
                List<Integer> keep      = bot.decideKeep(ctx, dice, filledMask, upperTotal, rules, rollsLeft);
                if (keep.size() == 5) break;

                int[]    next    = Arrays.copyOf(dice, 5);
                boolean[] keepBit = keepBitmask(keep);
                for (int i = 0; i < 5; i++)
                    if (!keepBit[i]) next[i] = (tape[turn][r][i] & 0xFF);
                dice = next;
            }

            String key = bot.decideScore(ctx, dice, filledMask, upperTotal, rules);
            int    val = rules.calculateScore(key, dice);
            scored.put(key, val);

            Integer slotIdx = ctx.slotIndex.get(key);
            if (slotIdx != null) {
                filledMask |= (1 << slotIdx);
                if (ctx.isUpperSlot(slotIdx))
                    upperTotal = Math.min(ctx.upperCap, upperTotal + val);
            } else {
                filledMask |= nextUnknownBit(filledMask, ctx.numSlots);
            }

            if ("YACHT".equals(key) && val == 0) yacht0 = true;
            if ("CHOICE".equals(key) && remainingBefore <= 4) choiceLate = true;
            turn++;
        }

        int bonus = upperTotal >= ctx.upperCap ? ctx.upperBonus : 0;
        int total = scored.values().stream().mapToInt(Integer::intValue).sum() + bonus;
        return new GameStats(total, bonus > 0, yacht0, choiceLate);
    }

    // ─── Tape 사전 생성 ──────────────────────────────────────────────────────

    private static byte[][][][] pregenerateTapes(int games, int maxTurns,
                                                   int maxRolls, int faces) {
        byte[][][][] tapes = new byte[games][maxTurns][maxRolls][5];
        IntStream.range(0, games).parallel().forEach(g -> {
            Random rng = ThreadLocalRandom.current();
            byte[][][] gt = tapes[g];
            for (int t = 0; t < maxTurns; t++)
                for (int r = 0; r < maxRolls; r++)
                    for (int d = 0; d < 5; d++)
                        gt[t][r][d] = (byte)(rng.nextInt(faces) + 1);
        });
        return tapes;
    }

    // ─── 결정 지연 측정 ──────────────────────────────────────────────────────

    private static void measureLatency(String label, YachtDpContext ctx, SimBot bot, YachtScoreRules rules) {
        int[] dice      = {3, 3, 3, 4, 5};
        int   filledMask = 0;
        int   rollsLeft  = ctx.maxRollsLeft;
        int   REPS      = 300;
        int   WARMUP    = 30;

        for (int i = 0; i < WARMUP; i++)
            bot.decideKeep(ctx, dice, filledMask, 0, rules, rollsLeft);

        long t0 = System.nanoTime();
        for (int i = 0; i < REPS; i++)
            bot.decideKeep(ctx, dice, filledMask, 0, rules, rollsLeft);
        long avgNs = (System.nanoTime() - t0) / REPS;
        System.out.printf("[%s] dp decideKeep(rollsLeft=%d) p50=%,d µs (%d회)%n",
                label, rollsLeft, avgNs / 1000, REPS);
    }

    // ─── 유틸 ────────────────────────────────────────────────────────────────

    private static int[] tapeRow(byte[] row) {
        int[] r = new int[5];
        for (int i = 0; i < 5; i++) r[i] = (row[i] & 0xFF);
        return r;
    }

    private static boolean[] keepBitmask(List<Integer> keep) {
        boolean[] b = new boolean[5];
        for (int idx : keep) b[idx] = true;
        return b;
    }

    private static List<Integer> indicesFromMask(int mask) {
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < 5; i++) if ((mask & (1 << i)) != 0) idx.add(i);
        return idx;
    }

    private static int nextUnknownBit(int filledMask, int numSlots) {
        for (int i = 0; i < numSlots; i++)
            if ((filledMask & (1 << i)) == 0) return (1 << i);
        return 0;
    }

    private static int ipow(int base, int exp) {
        int r = 1; for (int i = 0; i < exp; i++) r *= base; return r;
    }

    private static final List<Integer> ALL = List.of(0, 1, 2, 3, 4);

    // ─── YachtDpBot 독립 생성 (Spring 없이 테스트용) ─────────────────────────

    private static YachtDpBot createAndWaitForBot(YachtDpContext ctx) {
        YachtDpBot bot = new YachtDpBot();
        bot.init();
        long deadline = System.currentTimeMillis() + 180L * 60 * 1000;  // 최대 3시간 (D8 사전 계산)
        while (!bot.isReady(ctx) && System.currentTimeMillis() < deadline) {
            try { Thread.sleep(5_000); } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); break;
            }
        }
        if (!bot.isReady(ctx)) throw new IllegalStateException(
                "YachtDpBot 사전 계산 타임아웃: " + ctx.binFileName);
        return bot;
    }

    // ─── 결과 레코드 ─────────────────────────────────────────────────────────

    private record PairedResult(double meanBaseline, double meanImproved,
                                double meanDiff,     double stderrDiff,
                                double bonusRate,    double yacht0Rate,
                                double choiceLateRate) {}

    private record GameStats(int score, boolean bonusAchieved,
                             boolean yacht0Recorded, boolean choiceLate) {}
}
