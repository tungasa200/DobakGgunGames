package com.dobakggun.service.yacht.bot;

import com.dobakggun.service.yacht.D6Rules;
import com.dobakggun.service.yacht.D8Rules;
import com.dobakggun.service.yacht.YachtScoreRules;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 모드 종속 DP 파라미터 컨테이너. D6, D8 싱글톤 제공.
 *
 * 캡슐화 범위:
 *  - 룰 파라미터 (faces, slots, upperCap, rollsLeft 등)
 *  - 주사위 멀티셋 열거 (faces 기반 동적 계산)
 *  - V 캐시 인덱스 맵 keyToVIdx[packKey] → 0..vCacheSize-1
 *  - W 테이블 메타 (tableSize, binFileName)
 *
 * packKey compact 인코딩:
 *  - rollsLeft : 비트 0-1 (2비트, 0..3)
 *  - s[i]      : 비트 (2 + i*faceBits) ~ (1 + (i+1)*faceBits)
 *  - D6 faceBits=3 → 총 17비트, D8 faceBits=4 → 총 22비트
 */
public final class YachtDpContext {

    // ── 슬롯 순서 정의 (싱글톤 초기화 전에 먼저 선언 필수) ─────────────────────

    private static final String[] UPPER_ORDER = {
        "ONES","TWOS","THREES","FOURS","FIVES","SIXES","SEVENS","EIGHTS"
    };
    private static final String[] LOWER_ORDER = {
        "CHOICE","FOUR_OF_A_KIND","FULL_HOUSE","LITTLE_STRAIGHT","BIG_STRAIGHT","YACHT"
    };
    private static final int[] FACT = {1, 1, 2, 6, 24, 120};

    // ── 싱글톤 ───────────────────────────────────────────────────────────────

    public static final YachtDpContext D6 = new YachtDpContext(new D6Rules());
    public static final YachtDpContext D8 = new YachtDpContext(new D8Rules());

    // ── 룰 파라미터 ──────────────────────────────────────────────────────────

    public final YachtScoreRules rules;
    public final int faces;           // D6:6, D8:8
    public final int numUpperSlots;   // = faces
    public final int numSlots;        // D6:12, D8:14
    public final String[] slotNames;
    public final Map<String, Integer> slotIndex;
    public final int allFilled;       // (1 << numSlots) - 1
    public final int upperCap;        // D6:63, D8:108
    public final int upperBonus;      // 35
    public final int maxRollsLeft;    // maxRollsPerTurn-1 (D6:2, D8:3)

    // ── 멀티셋 ───────────────────────────────────────────────────────────────

    public final int[][] allMultisets;   // D6:252개, D8:792개
    public final int[] multinomials;
    public final int totalOutcomes;      // faces^5

    // ── V 캐시 ───────────────────────────────────────────────────────────────

    private final int faceBits;
    /** packKey(s, rl) → vCache 인덱스 0..vCacheSize-1. -1이면 유효 키 아님. */
    public final int[] keyToVIdx;
    public final int vCacheSize;         // (maxRollsLeft+1) × allMultisets.length

    // ── W 테이블 ─────────────────────────────────────────────────────────────

    public final int tableSize;          // (1<<numSlots) × (upperCap+1)
    public final String binFileName;

    // ── 생성자 ───────────────────────────────────────────────────────────────

    private YachtDpContext(YachtScoreRules rules) {
        this.rules = rules;
        this.faces = rules.rngFaces();
        this.numUpperSlots = faces;
        this.numSlots = rules.totalScoreKeys();
        this.allFilled = (1 << numSlots) - 1;
        this.upperCap = rules.upperBonusThreshold();
        this.upperBonus = rules.upperBonusValue();
        this.maxRollsLeft = rules.maxRollsPerTurn() - 1;

        // 슬롯 이름: 상단(faces개) + 하단(6개) 순서
        slotNames = new String[numSlots];
        for (int i = 0; i < numUpperSlots; i++) slotNames[i] = UPPER_ORDER[i];
        for (int i = 0; i < LOWER_ORDER.length; i++) slotNames[numUpperSlots + i] = LOWER_ORDER[i];
        slotIndex = new HashMap<>(numSlots * 2);
        for (int i = 0; i < numSlots; i++) slotIndex.put(slotNames[i], i);

        // 멀티셋 열거
        List<int[]>  ms = new ArrayList<>();
        List<Integer> mn = new ArrayList<>();
        enumMultisets(new int[5], 0, 1, ms, mn);
        allMultisets = ms.toArray(new int[0][]);
        multinomials = mn.stream().mapToInt(Integer::intValue).toArray();
        totalOutcomes = ipow(faces, 5);

        // packKey 비트폭: faceBits = ⌈log₂(faces)⌉ (D6→3, D8→4)
        this.faceBits = 32 - Integer.numberOfLeadingZeros(faces);

        // keyToVIdx 배열 (D6: ~112K, D8: ~2.2M)
        int maxKey = packKey(new int[]{faces, faces, faces, faces, faces}, maxRollsLeft);
        keyToVIdx = new int[maxKey + 1];
        Arrays.fill(keyToVIdx, -1);
        vCacheSize = (maxRollsLeft + 1) * allMultisets.length;
        for (int rl = 0; rl <= maxRollsLeft; rl++) {
            for (int i = 0; i < allMultisets.length; i++) {
                keyToVIdx[packKey(allMultisets[i], rl)] = rl * allMultisets.length + i;
            }
        }

        tableSize = (1 << numSlots) * (upperCap + 1);
        binFileName = "yacht-d" + faces + "-dp.bin";
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * 정렬된 주사위 배열과 rollsLeft로 V 캐시 인덱스 계산.
     * D6: rollBits=2, faceBits=3 → 기존 YachtDiceMultiset.packKey와 동일.
     */
    public int packKey(int[] s, int rollsLeft) {
        return rollsLeft
             | (s[0] << 2)
             | (s[1] << (2 + faceBits))
             | (s[2] << (2 + 2 * faceBits))
             | (s[3] << (2 + 3 * faceBits))
             | (s[4] << (2 + 4 * faceBits));
    }

    public boolean isUpperSlot(int slotBit) {
        return slotBit >= 0 && slotBit < numUpperSlots;
    }

    public int updateUpper(int upperTotal, int slotBit, int score) {
        if (!isUpperSlot(slotBit)) return upperTotal;
        return Math.min(upperCap, upperTotal + score);
    }

    // ── 멀티셋 열거 ──────────────────────────────────────────────────────────

    private void enumMultisets(int[] buf, int pos, int minVal,
                                List<int[]> out, List<Integer> mout) {
        if (pos == 5) {
            out.add(buf.clone());
            mout.add(multinomialCoef(buf));
            return;
        }
        for (int v = minVal; v <= faces; v++) {
            buf[pos] = v;
            enumMultisets(buf, pos + 1, v, out, mout);
        }
    }

    private static int multinomialCoef(int[] sorted) {
        int n = sorted.length, denom = 1, i = 0;
        while (i < n) {
            int j = i + 1;
            while (j < n && sorted[j] == sorted[i]) j++;
            denom *= FACT[j - i];
            i = j;
        }
        return FACT[n] / denom;
    }

    private static int ipow(int base, int exp) {
        int r = 1;
        for (int i = 0; i < exp; i++) r *= base;
        return r;
    }
}
