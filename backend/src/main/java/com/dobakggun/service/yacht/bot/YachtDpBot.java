package com.dobakggun.service.yacht.bot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * D6/D8 야추 풀 DP 봇. Spring 컴포넌트 빈으로 등록.
 * D6/D8 W 테이블을 각각 AtomicReference로 관리.
 *
 * 기동 시 classpath에서 테이블 로드 시도.
 * 없으면 백그라운드 스레드에서 사전 계산 후 저장.
 *
 * vCache/vDone은 두 모드 중 큰 쪽(D8: vCacheSize=3168)으로 통일해 ThreadLocal 재사용.
 * decideKeep 호출 시 boxing/GC 없음.
 */
@Slf4j
@Component
public class YachtDpBot {

    private static final int MAX_V_CACHE =
            Math.max(YachtDpContext.D6.vCacheSize, YachtDpContext.D8.vCacheSize);

    private final AtomicReference<double[]> d6TableRef = new AtomicReference<>();
    private final AtomicReference<double[]> d8TableRef = new AtomicReference<>();

    private static final ThreadLocal<double[]>  V_CACHE_TL =
            ThreadLocal.withInitial(() -> new double[MAX_V_CACHE]);
    private static final ThreadLocal<boolean[]> V_DONE_TL  =
            ThreadLocal.withInitial(() -> new boolean[MAX_V_CACHE]);

    @PostConstruct
    public void init() {
        initCtx(YachtDpContext.D6, d6TableRef);
        initCtx(YachtDpContext.D8, d8TableRef);
    }

    private void initCtx(YachtDpContext ctx, AtomicReference<double[]> tableRef) {
        double[] loaded = YachtDpTable.load(ctx);
        if (loaded != null) {
            tableRef.set(loaded);
            log.info("YachtDpBot: W 테이블 로드 완료 ({} entries, {})", loaded.length, ctx.binFileName);
            return;
        }

        log.info("YachtDpBot: 백그라운드 사전 계산 시작 ({})", ctx.binFileName);
        Thread t = new Thread(() -> {
            try {
                long t0 = System.currentTimeMillis();
                double[] w = YachtDpPrecomputer.precompute(ctx);
                tableRef.set(w);
                log.info("YachtDpBot: 사전 계산 완료 ({}, {}ms)",
                        ctx.binFileName, System.currentTimeMillis() - t0);

                Path resourcesDir = findResourcesDir();
                if (resourcesDir != null) {
                    YachtDpTable.save(w, resourcesDir, ctx);
                } else {
                    log.warn("YachtDpBot: resources 디렉터리를 찾을 수 없어 저장 생략 ({})", ctx.binFileName);
                }
            } catch (Exception e) {
                log.error("YachtDpBot: 사전 계산 실패 ({})", ctx.binFileName, e);
            }
        }, "yacht-dp-precompute-d" + ctx.faces);
        t.setDaemon(true);
        t.start();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * 유지할 주사위 인덱스 리스트 반환.
     *
     * @param ctx        모드 컨텍스트 (YachtDpContext.D6 or D8)
     * @param dice       현재 주사위 (5개)
     * @param rollsLeft  이 결정 후 남은 굴림 횟수 (≥ 1)
     * @param filledMask 이미 채워진 슬롯 비트마스크
     * @param upperTotal 현재 상단 누적 점수 (0..ctx.upperCap)
     * @return 유지할 원본 인덱스 리스트. 크기 5 = 조기 종료 신호
     */
    public List<Integer> decideKeep(YachtDpContext ctx, int[] dice, int rollsLeft,
                                     int filledMask, int upperTotal) {
        double[] w = requireTable(ctx);

        int[]  sortOrder = YachtDiceMultiset.sortOrder(dice);
        int[]  sorted    = YachtDiceMultiset.applySortOrder(dice, sortOrder);

        double[]  vCache = V_CACHE_TL.get();
        boolean[] vDone  = V_DONE_TL.get();
        Arrays.fill(vDone, 0, ctx.vCacheSize, false);

        int    bestMask = 31;
        double bestEv   = Double.NEGATIVE_INFINITY;
        for (int mask = 0; mask < 32; mask++) {
            double ev = YachtDpEngine.maskEv(ctx, sorted, mask, rollsLeft,
                                              filledMask, upperTotal, w, vCache, vDone);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return YachtDiceMultiset.sortedMaskToOriginalIndices(bestMask, sortOrder);
    }

    /**
     * 점수를 기록할 슬롯 키 반환.
     *
     * @param ctx        모드 컨텍스트
     * @param dice       현재 주사위 (5개)
     * @param filledMask 이미 채워진 슬롯 비트마스크
     * @param upperTotal 현재 상단 누적 점수
     * @return 슬롯 키 문자열 (예: "YACHT", "SIXES")
     */
    public String decideScore(YachtDpContext ctx, int[] dice, int filledMask, int upperTotal) {
        double[] w = requireTable(ctx);
        int k = YachtDpEngine.bestScoreSlot(ctx, dice, filledMask, upperTotal, w);
        return k >= 0 ? ctx.slotNames[k] : null;
    }

    /** 해당 모드 W 테이블 준비 완료 여부. */
    public boolean isReady(YachtDpContext ctx) {
        return tableRef(ctx).get() != null;
    }

    /** W 테이블 직접 접근 (시뮬레이터 검증용). */
    public double[] getWTable(YachtDpContext ctx) {
        return requireTable(ctx);
    }

    // ── 변환 유틸 ─────────────────────────────────────────────────────────────

    /**
     * scored Map(슬롯키 → 점수) → filledMask 변환.
     * 해당 ctx에 없는 키(다른 모드 키)는 자동으로 무시됨.
     */
    public static int computeFilledMaskFromScored(YachtDpContext ctx, Map<String, Integer> scored) {
        int mask = 0;
        for (String key : scored.keySet()) {
            Integer idx = ctx.slotIndex.get(key);
            if (idx != null) mask |= (1 << idx);
        }
        return mask;
    }

    /**
     * validScoreKeys 전체에서 remaining을 제외한 슬롯 → filledMask 변환.
     */
    public static int computeFilledMask(YachtDpContext ctx, Set<String> allKeys, Set<String> remaining) {
        int mask = 0;
        for (String key : allKeys) {
            if (!remaining.contains(key)) {
                Integer idx = ctx.slotIndex.get(key);
                if (idx != null) mask |= (1 << idx);
            }
        }
        return mask;
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    private AtomicReference<double[]> tableRef(YachtDpContext ctx) {
        return ctx.faces == 6 ? d6TableRef : d8TableRef;
    }

    private double[] requireTable(YachtDpContext ctx) {
        double[] w = tableRef(ctx).get();
        if (w == null)
            throw new IllegalStateException(
                "YachtDpBot: W 테이블 사전 계산 진행 중 — 잠시 후 다시 시도하세요 (" + ctx.binFileName + ")");
        return w;
    }

    private static Path findResourcesDir() {
        try {
            var location = YachtDpBot.class.getProtectionDomain()
                    .getCodeSource().getLocation();
            if (location == null) return null;
            // build/classes/java/main → (상위 4단계) → 프로젝트 루트 → src/main/resources
            Path classLoc = Paths.get(location.toURI());
            Path candidate = classLoc.getParent().getParent().getParent().getParent()
                    .resolve("src/main/resources");
            if (candidate.toFile().isDirectory()) return candidate;
        } catch (Exception ignored) {}
        return null;
    }
}
