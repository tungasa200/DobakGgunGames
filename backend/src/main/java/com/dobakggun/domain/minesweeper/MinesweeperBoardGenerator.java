package com.dobakggun.domain.minesweeper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 시드 기반 지뢰찾기 보드 생성 유틸.
 * <p>
 * 동일 seed 로 호출하면 항상 동일한 adjMines 배열을 반환 → 1P/2P 보드 완전 일치 보장.
 * 지뢰 좌표 배열은 반환하지 않음 (보안 — §11.3).
 */
public final class MinesweeperBoardGenerator {

    private MinesweeperBoardGenerator() {
        // 유틸 클래스 — 인스턴스화 금지
    }

    /**
     * adjMines 배열을 생성하여 반환한다.
     *
     * @param seed   보드 시드 (동일 seed = 동일 보드)
     * @param rows   행 수 (= 9)
     * @param cols   열 수 (= 9)
     * @param mines  지뢰 개수 (= 10)
     * @param safeR  안전 보장 셀의 행 (0-index, 지정 클릭 셀 = 4)
     * @param safeC  안전 보장 셀의 열 (0-index, 지정 클릭 셀 = 4)
     * @return int[rows][cols] — -1=지뢰, 0~8=인접 지뢰 수
     */
    public static int[][] generate(long seed, int rows, int cols, int mines, int safeR, int safeC) {
        // 1. forbidden 집합: (safeR, safeC) 및 8방향 인접 셀
        boolean[][] forbidden = new boolean[rows][cols];
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                int r = safeR + dr;
                int c = safeC + dc;
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    forbidden[r][c] = true;
                }
            }
        }

        // 2. 지뢰를 배치할 수 있는 후보 셀 목록
        List<int[]> candidates = new ArrayList<>(rows * cols);
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (!forbidden[r][c]) {
                    candidates.add(new int[]{r, c});
                }
            }
        }

        // 3. 시드 기반 Random 으로 mines 개 셀 추출
        Random rng = new Random(seed);
        Collections.shuffle(candidates, rng);

        boolean[][] minePlaced = new boolean[rows][cols];
        int placed = 0;
        for (int[] cell : candidates) {
            if (placed >= mines) break;
            minePlaced[cell[0]][cell[1]] = true;
            placed++;
        }

        // placed < mines 인 경우는 forbidden 영역 외 셀이 mines 개보다 많을 때만 발생하지 않음
        // (9×9=81, forbidden 최대 9칸, 가용 72칸 > 10개) — 보장됨

        // 4. adjMines 계산
        int[][] adjMines = new int[rows][cols];
        int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
        int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};

        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (minePlaced[r][c]) {
                    adjMines[r][c] = -1;
                    continue;
                }
                int count = 0;
                for (int d = 0; d < 8; d++) {
                    int nr = r + dr[d];
                    int nc = c + dc[d];
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && minePlaced[nr][nc]) {
                        count++;
                    }
                }
                adjMines[r][c] = count;
            }
        }

        return adjMines;
    }
}
