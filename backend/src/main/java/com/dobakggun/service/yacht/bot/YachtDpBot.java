package com.dobakggun.service.yacht.bot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * D6 야추 풀 DP 봇. Spring 컴포넌트 빈으로 등록.
 * W 테이블을 싱글톤으로 공유하며, 결정 1회당 &lt;10ms.
 *
 * 기동 시 classpath에서 테이블 로드 시도.
 * 없으면 백그라운드 스레드에서 사전 계산 후 저장.
 */
@Slf4j
@Component
public class YachtDpBot {

    private final AtomicReference<double[]> tableRef = new AtomicReference<>();

    @PostConstruct
    public void init() {
        double[] loaded = YachtDpTable.load();
        if (loaded != null) {
            tableRef.set(loaded);
            log.info("YachtDpBot: W 테이블 로드 완료 ({} entries)", loaded.length);
            return;
        }

        log.info("YachtDpBot: 백그라운드 사전 계산 시작...");
        Thread t = new Thread(() -> {
            try {
                long t0 = System.currentTimeMillis();
                double[] w = YachtDpPrecomputer.precompute();
                tableRef.set(w);
                log.info("YachtDpBot: 사전 계산 완료 ({}ms)", System.currentTimeMillis() - t0);

                Path resourcesDir = findResourcesDir();
                if (resourcesDir != null) {
                    YachtDpTable.save(w, resourcesDir);
                } else {
                    log.warn("YachtDpBot: resources 디렉터리를 찾을 수 없어 테이블 저장 생략");
                }
            } catch (Exception e) {
                log.error("YachtDpBot: 사전 계산 실패", e);
            }
        }, "yacht-dp-precompute");
        t.setDaemon(true);
        t.start();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * 유지할 주사위 인덱스 리스트 반환.
     *
     * @param dice       현재 주사위 (5개, 각 1~6)
     * @param rollsLeft  이 결정 후 남은 굴림 횟수 (≥ 1)
     * @param filledMask 이미 채워진 슬롯 비트마스크 (12비트)
     * @param upperTotal 현재 상단 누적 점수 (0..63)
     * @return 유지할 원본 인덱스 리스트. 크기 5 = 조기 종료 신호
     * @throws IllegalStateException W 테이블 미준비
     */
    public List<Integer> decideKeep(int[] dice, int rollsLeft,
                                     int filledMask, int upperTotal) {
        double[] w = requireTable();

        int[] sortOrder = YachtDiceMultiset.sortOrder(dice);
        int[] sorted    = YachtDiceMultiset.applySortOrder(dice, sortOrder);
        Map<Long, Double> vMemo = new HashMap<>(256);

        int    bestMask = 31;
        double bestEv   = Double.NEGATIVE_INFINITY;
        for (int mask = 0; mask < 32; mask++) {
            double ev = YachtDpEngine.maskEv(sorted, mask, rollsLeft,
                                              filledMask, upperTotal, w, vMemo);
            if (ev > bestEv) { bestEv = ev; bestMask = mask; }
        }
        return YachtDiceMultiset.sortedMaskToOriginalIndices(bestMask, sortOrder);
    }

    /**
     * 점수를 기록할 슬롯 키 반환.
     *
     * @param dice       현재 주사위 (5개, 각 1~6)
     * @param filledMask 이미 채워진 슬롯 비트마스크 (12비트)
     * @param upperTotal 현재 상단 누적 점수 (0..63)
     * @return 슬롯 키 문자열 (예: "YACHT", "SIXES")
     */
    public String decideScore(int[] dice, int filledMask, int upperTotal) {
        double[] w = requireTable();
        int k = YachtDpEngine.bestScoreSlot(dice, filledMask, upperTotal, w);
        return k >= 0 ? YachtDpEngine.SLOT_NAMES[k] : null;
    }

    /** W 테이블 준비 완료 여부. */
    public boolean isReady() {
        return tableRef.get() != null;
    }

    // ── 변환 유틸 ─────────────────────────────────────────────────────────────

    /**
     * scored Map(슬롯키 → 점수) → filledMask 변환.
     * D8 키("SEVENS", "EIGHTS")는 SLOT_INDEX에 없으므로 자동으로 무시됨.
     */
    public static int computeFilledMaskFromScored(Map<String, Integer> scored) {
        int mask = 0;
        for (String key : scored.keySet()) {
            Integer idx = YachtDpEngine.SLOT_INDEX.get(key);
            if (idx != null) mask |= (1 << idx);
        }
        return mask;
    }

    /**
     * validScoreKeys 전체에서 remaining을 제외한 슬롯 → filledMask 변환.
     */
    public static int computeFilledMask(Set<String> allKeys, Set<String> remaining) {
        int mask = 0;
        for (String key : allKeys) {
            if (!remaining.contains(key)) {
                Integer idx = YachtDpEngine.SLOT_INDEX.get(key);
                if (idx != null) mask |= (1 << idx);
            }
        }
        return mask;
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    private double[] requireTable() {
        double[] w = tableRef.get();
        if (w == null)
            throw new IllegalStateException(
                "YachtDpBot: W 테이블 사전 계산 진행 중 — 잠시 후 다시 시도하세요");
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
