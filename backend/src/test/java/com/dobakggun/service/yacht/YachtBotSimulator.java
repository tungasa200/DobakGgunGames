package com.dobakggun.service.yacht;

import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;

/**
 * YachtBotStrategy Paired-Sampling 시뮬레이터.
 *
 * 실행: ./gradlew test --tests "*YachtBotSimulator*"
 *
 * ── Paired sampling ──────────────────────────────────────────────────────────
 * 베이스라인·개선봇이 동일한 dice tape를 소비 → 공통 분산 제거, 작은 n에서도
 * 유의미한 차이를 검출.  tape[game][turn][roll][die] 사전 생성 후 두 봇에 공급.
 *
 * ── Memo 공유 ────────────────────────────────────────────────────────────────
 * 개선봇은 턴 내 costMap·memo를 한 번 생성해 모든 굴림 결정에 재사용.
 * (YachtBotStrategy.decideKeepShared / costMapFor — package-private)
 *
 * ── Auto-scale ───────────────────────────────────────────────────────────────
 * |paired-t| < SIG_THRESHOLD → 게임 수 4배 증가 (GAMES_MAX 상한).
 * 차이가 충분히 크면 10,000게임에서도 t >> 2이므로 조기 수렴.
 */
public class YachtBotSimulator {

    private static final int    GAMES_INITIAL   = 10_000;
    private static final int    GAMES_MAX       = 400_000;
    private static final double SIG_THRESHOLD   = 2.0;   // 95% 유의수준 근사

    // ─── 전략 인터페이스 ─────────────────────────────────────────────────────

    interface SimBot {
        /**
         * @param costMap  턴 시작 시 생성된 costMap (공유)
         * @param memo     턴 시작 시 생성된 DP memo (공유)
         */
        List<Integer> decideKeep(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                  int rollsLeft, Map<String, Double> costMap,
                                  Map<Long, Double> memo);

        String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules,
                           int upperTotal);

        /** 턴 시작 시 costMap 생성. 베이스라인은 정적 맵 반환. */
        Map<String, Double> buildCostMap(YachtScoreRules rules, Set<String> remaining,
                                          int upperTotal);
    }

    // ─── 베이스라인 (구 알고리즘) ─────────────────────────────────────────────

    static final class BaselineBot implements SimBot {

        private static final Map<String, Double> COST_D6 = Map.ofEntries(
                Map.entry("ONES", 3.0),   Map.entry("TWOS", 6.0),    Map.entry("THREES", 9.0),
                Map.entry("FOURS", 12.0), Map.entry("FIVES", 15.0),  Map.entry("SIXES", 18.0),
                Map.entry("CHOICE", 17.5),          Map.entry("FOUR_OF_A_KIND", 9.5),
                Map.entry("FULL_HOUSE", 9.2),       Map.entry("LITTLE_STRAIGHT", 8.6),
                Map.entry("BIG_STRAIGHT", 13.6),    Map.entry("YACHT", 6.0));

        private static final Map<String, Double> COST_D8 = Map.ofEntries(
                Map.entry("ONES", 2.5),   Map.entry("TWOS", 5.0),    Map.entry("THREES", 7.5),
                Map.entry("FOURS", 10.0), Map.entry("FIVES", 12.5),  Map.entry("SIXES", 15.0),
                Map.entry("SEVENS", 17.0),Map.entry("EIGHTS", 20.0),
                Map.entry("CHOICE", 17.5),          Map.entry("FOUR_OF_A_KIND", 9.5),
                Map.entry("FULL_HOUSE", 9.2),       Map.entry("LITTLE_STRAIGHT", 8.6),
                Map.entry("BIG_STRAIGHT", 13.6),    Map.entry("YACHT", 6.0));

        @Override
        public Map<String, Double> buildCostMap(YachtScoreRules rules, Set<String> remaining,
                                                 int upperTotal) {
            return rules.rngFaces() == 8 ? COST_D8 : COST_D6;
        }

        /** 1-step brute-force EV, raw score (cost 미반영). rollsLeft/memo 무시. */
        @Override
        public List<Integer> decideKeep(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                         int rollsLeft, Map<String, Double> costMap,
                                         Map<Long, Double> memo) {
            if (remaining.isEmpty()) return ALL;
            int    faces    = rules.rngFaces();
            int    bestMask = 31;
            double bestEv   = -1.0;
            for (int mask = 0; mask < 32; mask++) {
                double ev = oneStepEv(dice, mask, remaining, rules, faces);
                if (ev > bestEv) { bestEv = ev; bestMask = mask; }
            }
            return indicesFromMask(bestMask);
        }

        private static double oneStepEv(int[] dice, int mask, Set<String> remaining,
                                         YachtScoreRules rules, int faces) {
            int reroll = 5 - Integer.bitCount(mask);
            int total  = ipow(faces, reroll);
            double sum = 0;
            for (int combo = 0; combo < total; combo++) {
                int[] result = buildResult(dice, mask, combo, faces);
                double best  = 0;
                for (String k : remaining) { int s = rules.calculateScore(k, result); if (s > best) best = s; }
                sum += best;
            }
            return sum / total;
        }

        /**
         * 구 버전 decideScore: 0점과 양수를 별도 트랙으로 비교 (P0 수정 전 버그 재현).
         * bestNonZero가 있으면 무조건 반환 — 음수 net을 처리하지 않음.
         */
        @Override
        public String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                   int upperTotal) {
            Map<String, Double> costMap = rules.rngFaces() == 8 ? COST_D8 : COST_D6;
            String bestNZ = null; double bestNet = Double.NEGATIVE_INFINITY; int bestScore = -1;
            String bestZ  = null; double lowestCost = Double.MAX_VALUE;
            for (String key : remaining) {
                int    score = rules.calculateScore(key, dice);
                double cost  = costMap.getOrDefault(key, 10.0);
                if (score > 0) {
                    double net = score - cost;
                    if (net > bestNet || (net == bestNet && score > bestScore)) {
                        bestNet = net; bestScore = score; bestNZ = key;
                    }
                } else if (cost < lowestCost) { lowestCost = cost; bestZ = key; }
            }
            return bestNZ != null ? bestNZ : bestZ;
        }

        private static int[] buildResult(int[] dice, int mask, int combo, int faces) {
            int[] r = Arrays.copyOf(dice, 5); int t = combo;
            for (int i = 0; i < 5; i++) if ((mask & (1 << i)) == 0) { r[i] = (t % faces) + 1; t /= faces; }
            return r;
        }
    }

    // ─── 개선봇 (YachtBotStrategy 위임) ──────────────────────────────────────

    static final class ImprovedBot implements SimBot {
        private final YachtBotStrategy inner = new YachtBotStrategy();

        @Override
        public Map<String, Double> buildCostMap(YachtScoreRules rules, Set<String> remaining,
                                                 int upperTotal) {
            return inner.costMapFor(rules, remaining, upperTotal);
        }

        /** 제공된 costMap·memo를 재사용 — 턴 내 중복 빌드 없음. */
        @Override
        public List<Integer> decideKeep(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                         int rollsLeft, Map<String, Double> costMap,
                                         Map<Long, Double> memo) {
            return inner.decideKeepShared(dice, remaining, rules, rollsLeft, costMap, memo);
        }

        @Override
        public String decideScore(int[] dice, Set<String> remaining, YachtScoreRules rules,
                                   int upperTotal) {
            return inner.decideScore(dice, remaining, rules, upperTotal);
        }
    }

    // ─── JUnit 진입점 ────────────────────────────────────────────────────────

    @Test void compareD6() { compare("D6", new D6Rules()); }
    @Test void compareD8() { compare("D8", new D8Rules()); }

    // ─── Paired 비교 ─────────────────────────────────────────────────────────

    private static void compare(String label, YachtScoreRules rules) {
        SimBot baseline = new BaselineBot();
        SimBot improved = new ImprovedBot();

        int games = GAMES_INITIAL;
        PairedResult r;

        do {
            long t0 = System.currentTimeMillis();
            r = runPaired(baseline, improved, rules, games);
            long elapsed = System.currentTimeMillis() - t0;

            double tStat = r.meanDiff / r.stderrDiff;
            System.out.printf(
                "[%s] n=%,d | baseline=%.2f | improved=%.2f | Δ=+%.2f (95%%CI ±%.2f) | t=%.2f | %.1fs%n",
                label, games,
                r.meanBaseline, r.meanImproved,
                r.meanDiff, 1.96 * r.stderrDiff,
                tStat, elapsed / 1000.0);

            if (Math.abs(tStat) >= SIG_THRESHOLD || games >= GAMES_MAX) break;

            int next = Math.min(games * 4, GAMES_MAX);
            System.out.printf("[%s] t=%.2f < %.1f → %,d게임으로 재측정%n",
                    label, tStat, SIG_THRESHOLD, next);
            games = next;
        } while (true);

        measureLatency(label, improved, rules);
    }

    // ─── Paired 실행 (parallelStream) ────────────────────────────────────────

    private static PairedResult runPaired(SimBot baseline, SimBot improved,
                                           YachtScoreRules rules, int games) {
        int maxTurns = rules.totalScoreKeys();
        int maxRolls = rules.maxRollsPerTurn();
        int faces    = rules.rngFaces();

        // Tape 사전 생성: tape[game][turn][roll][die]
        // 동일 시퀀스를 두 봇에 공급 → paired sampling
        byte[][][][] tapes = pregenerateTapes(games, maxTurns, maxRolls, faces);

        // 두 봇 병렬 실행 (각각 독립 parallelStream)
        int[] baselineScores = IntStream.range(0, games).parallel()
                .map(i -> playWithTape(baseline, rules, tapes[i], maxRolls)).toArray();
        int[] improvedScores = IntStream.range(0, games).parallel()
                .map(i -> playWithTape(improved, rules, tapes[i], maxRolls)).toArray();

        // Paired 통계
        double sumB = 0, sumI = 0, sumD = 0, sumD2 = 0;
        for (int i = 0; i < games; i++) {
            double b = baselineScores[i], iv = improvedScores[i], d = iv - b;
            sumB += b; sumI += iv; sumD += d; sumD2 += d * d;
        }
        double meanB  = sumB / games;
        double meanI  = sumI / games;
        double meanD  = sumD / games;
        double varD   = sumD2 / games - meanD * meanD;
        double stderr = Math.sqrt(varD / games);
        return new PairedResult(meanB, meanI, meanD, stderr);
    }

    // ─── 1게임 플레이 ────────────────────────────────────────────────────────

    private static int playWithTape(SimBot bot, YachtScoreRules rules,
                                     byte[][][] tape /* [turn][roll][die] */,
                                     int maxRolls) {
        Set<String>          remaining  = new HashSet<>(rules.validScoreKeys());
        Map<String, Integer> scored     = new HashMap<>();
        int                  upperTotal = 0;
        int                  turn       = 0;

        while (!remaining.isEmpty()) {
            // 턴 시작: costMap + memo 한 번 생성 후 모든 굴림 결정에 공유
            Map<String, Double> costMap = bot.buildCostMap(rules, remaining, upperTotal);
            Map<Long, Double>   memo    = new HashMap<>();

            // 첫 굴림 강제 (tape[turn][0])
            int[] dice = tapeRow(tape[turn][0]);

            for (int r = 1; r < maxRolls; r++) {
                int           rollsLeft = maxRolls - r;
                List<Integer> keep      = bot.decideKeep(dice, remaining, rules,
                                                          rollsLeft, costMap, memo);
                if (keep.size() == 5) break;

                // reroll 위치만 tape[turn][r]에서 교체
                int[]        next    = Arrays.copyOf(dice, 5);
                boolean[]    keepBit = keepBitmask(keep);
                for (int i = 0; i < 5; i++) {
                    if (!keepBit[i]) next[i] = (tape[turn][r][i] & 0xFF);
                }
                dice = next;
            }

            String key = bot.decideScore(dice, remaining, rules, upperTotal);
            int    val = rules.calculateScore(key, dice);
            scored.put(key, val);
            remaining.remove(key);
            if (rules.upperKeys().contains(key)) upperTotal += val;
            turn++;
        }

        int bonus = upperTotal >= rules.upperBonusThreshold() ? rules.upperBonusValue() : 0;
        return scored.values().stream().mapToInt(Integer::intValue).sum() + bonus;
    }

    // ─── Tape 사전 생성 ───────────────────────────────────────────────────────

    /**
     * byte[][][][] tapes[game][turn][roll][die].
     * byte 사용: 메모리 절약 (int 대비 4x). 값은 1..faces, unsigned 읽기 필요.
     * 생성 자체도 parallelStream으로 수행.
     */
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

    private static void measureLatency(String label, SimBot bot, YachtScoreRules rules) {
        int[]       dice      = {3, 3, 3, 4, 5};
        Set<String> remaining = new HashSet<>(rules.validScoreKeys());
        int         REPS      = 300;
        int         WARMUP    = 30;

        Map<String, Double> costMap = bot.buildCostMap(rules, remaining, 0);
        Map<Long, Double>   memo    = new HashMap<>();

        for (int i = 0; i < WARMUP; i++) {
            bot.decideKeep(dice, remaining, rules, 2, costMap, new HashMap<>());
        }

        long t0 = System.nanoTime();
        for (int i = 0; i < REPS; i++) {
            bot.decideKeep(dice, remaining, rules, 2, costMap, new HashMap<>());
        }
        long avgNs = (System.nanoTime() - t0) / REPS;
        System.out.printf("[%s] improved decideKeep(rollsLeft=2) p50=%,d µs (%d회)%n",
                label, avgNs / 1000, REPS);
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

    private static int ipow(int base, int exp) {
        int r = 1; for (int i = 0; i < exp; i++) r *= base; return r;
    }

    private static final List<Integer> ALL = List.of(0, 1, 2, 3, 4);

    // ─── 결과 레코드 ─────────────────────────────────────────────────────────

    record PairedResult(double meanBaseline, double meanImproved,
                        double meanDiff, double stderrDiff) {}
}
