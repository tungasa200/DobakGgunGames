package com.dobakggun.service.yacht.bot;

import java.util.ArrayList;
import java.util.List;

/** D6 5주사위 정렬 다중집합(multiset) 유틸리티. Spring 비의존, 순수 계산. */
public final class YachtDiceMultiset {

    /** 252개 정렬 다중집합: ALL_MULTISETS[i] = int[5] (오름차순, 각 원소 1..6) */
    public static final int[][] ALL_MULTISETS;
    /** 각 다중집합의 다항계수: MULTINOMIALS[i] = 5! / Π(count_j!) */
    public static final int[]   MULTINOMIALS;
    /** 6^5 = 7776 */
    public static final int     TOTAL_OUTCOMES = 7776;

    private static final int[] FACT = {1, 1, 2, 6, 24, 120};

    static {
        List<int[]>  list  = new ArrayList<>(252);
        List<Integer> mList = new ArrayList<>(252);
        enumerate(new int[5], 0, 1, list, mList);
        ALL_MULTISETS = list.toArray(new int[0][]);
        MULTINOMIALS  = mList.stream().mapToInt(Integer::intValue).toArray();
    }

    private static void enumerate(int[] buf, int pos, int minVal,
                                   List<int[]> out, List<Integer> mout) {
        if (pos == 5) {
            out.add(buf.clone());
            mout.add(multinomial(buf));
            return;
        }
        for (int v = minVal; v <= 6; v++) {
            buf[pos] = v;
            enumerate(buf, pos + 1, v, out, mout);
        }
    }

    /** 정렬 배열의 다항계수: 5! / Π(ci!) */
    public static int multinomial(int[] sorted) {
        int n = sorted.length;
        int denom = 1;
        int i = 0;
        while (i < n) {
            int j = i + 1;
            while (j < n && sorted[j] == sorted[i]) j++;
            denom *= FACT[j - i];
            i = j;
        }
        return FACT[n] / denom;
    }

    /** 두 정렬 배열을 merge-sort 방식으로 병합. */
    public static int[] mergeSorted(int[] a, int[] b) {
        int[] result = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length)
            result[k++] = (a[i] <= b[j]) ? a[i++] : b[j++];
        while (i < a.length) result[k++] = a[i++];
        while (j < b.length) result[k++] = b[j++];
        return result;
    }

    /** sortedDice에서 mask 비트가 1인 위치만 정렬 추출. */
    public static int[] extractKeptSorted(int[] sortedDice, int mask) {
        int k = Integer.bitCount(mask);
        if (k == 0) return new int[0];
        int[] kept = new int[k];
        int idx = 0;
        for (int i = 0; i < 5; i++)
            if ((mask & (1 << i)) != 0) kept[idx++] = sortedDice[i];
        return kept;
    }

    /** 메모 키: 정렬 주사위 5개(각 4비트) + rollsLeft(4비트) = 24비트 long. */
    public static long packKey(int[] s, int rollsLeft) {
        return ((long) rollsLeft)
             | ((long) s[0] << 4)  | ((long) s[1] << 8)
             | ((long) s[2] << 12) | ((long) s[3] << 16)
             | ((long) s[4] << 20);
    }

    /** dice[i] 기준 오름차순 정렬 순서 반환. */
    public static int[] sortOrder(int[] dice) {
        Integer[] idx = {0, 1, 2, 3, 4};
        java.util.Arrays.sort(idx, (a, b) -> dice[a] - dice[b]);
        int[] order = new int[5];
        for (int i = 0; i < 5; i++) order[i] = idx[i];
        return order;
    }

    /** sortOrder를 적용해 정렬된 배열 반환. */
    public static int[] applySortOrder(int[] dice, int[] order) {
        int[] s = new int[5];
        for (int i = 0; i < 5; i++) s[i] = dice[order[i]];
        return s;
    }

    /** sorted 기준 mask의 유지 비트를 원본 dice 인덱스 리스트로 변환. */
    public static java.util.List<Integer> sortedMaskToOriginalIndices(int mask, int[] sortOrder) {
        java.util.List<Integer> idx = new java.util.ArrayList<>();
        for (int i = 0; i < 5; i++)
            if ((mask & (1 << i)) != 0) idx.add(sortOrder[i]);
        return idx;
    }

    private YachtDiceMultiset() {}
}
