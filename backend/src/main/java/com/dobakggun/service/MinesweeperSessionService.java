package com.dobakggun.service;

import com.dobakggun.dto.MinesweeperSessionStartRequest;
import com.dobakggun.dto.MinesweeperSessionStartResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * Phase 3 — 지뢰찾기: 서버가 지뢰 배치를 생성하고 검증.
 * <ul>
 *   <li>firstClick 좌표를 포함한 세션 생성 → 첫 클릭 안전 보장</li>
 *   <li>adjMines 응답: -1 = 지뢰, 0~8 = 인접 지뢰 수</li>
 *   <li>extra.minePositions 저장 → 클리어 검증 시 활용</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class MinesweeperSessionService {

    /** 난이도 → [rows, cols, mines] */
    private static final Map<String, int[]> PRESETS = Map.of(
        "beginner",     new int[]{9,  9,  10},
        "intermediate", new int[]{16, 16, 40},
        "expert",       new int[]{16, 30, 99}
    );
    private static final long EXPIRE_SECONDS = 7200L;

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;

    @Transactional
    public MinesweeperSessionStartResponse createSession(
            MinesweeperSessionStartRequest req,
            HttpServletRequest httpReq) {

        int[] preset = PRESETS.get(req.getLevel());
        if (preset == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 레벨입니다.");
        }

        int rows = preset[0], cols = preset[1], mines = preset[2];

        // 지뢰 배치 생성 (firstClick 및 인접 8칸 제외)
        boolean[][] mineGrid = generateMines(rows, cols, mines, req.getFirstClickR(), req.getFirstClickC());

        // adjMines 계산 (지뢰 셀 = -1)
        int[][] adjMines = computeAdjMines(mineGrid, rows, cols);

        // 지뢰 위치 목록 저장 (서버 검증용)
        List<int[]> minePositions = new ArrayList<>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (mineGrid[r][c]) minePositions.add(new int[]{r, c});

        Instant now = Instant.now();
        String sessionId = UUID.randomUUID().toString();
        String ipHash    = ipHashUtil.hash(getClientIp(httpReq));

        Map<String, Object> extra = new HashMap<>();
        extra.put("rows",          rows);
        extra.put("cols",          cols);
        extra.put("minePositions", minePositions);

        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game("minesweeper")
            .level(req.getLevel())
            .ipHash(ipHash)
            .startedAt(now)
            .build();

        try {
            session.setExtra(objectMapper.writeValueAsString(extra));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 생성 오류");
        }
        sessionRepo.save(session);

        return MinesweeperSessionStartResponse.builder()
            .sessionId(sessionId)
            .startedAt(now.toEpochMilli())
            .expiresAt(now.plusSeconds(EXPIRE_SECONDS).toEpochMilli())
            .adjMines(adjMines)
            .build();
    }

    // ── 내부 유틸 ──────────────────────────────────────────────────────

    private boolean[][] generateMines(int rows, int cols, int mines,
                                       Integer firstR, Integer firstC) {
        boolean[][] grid = new boolean[rows][cols];
        Random rng = new Random();
        int planted = 0;
        while (planted < mines) {
            int r = rng.nextInt(rows);
            int c = rng.nextInt(cols);
            if (grid[r][c]) continue;
            // firstClick 및 인접 8칸 제외
            if (firstR != null && firstC != null && isAdjacent(r, c, firstR, firstC)) continue;
            grid[r][c] = true;
            planted++;
        }
        return grid;
    }

    private int[][] computeAdjMines(boolean[][] grid, int rows, int cols) {
        int[][] adj = new int[rows][cols];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (grid[r][c]) {
                    adj[r][c] = -1;   // 지뢰
                    continue;
                }
                int count = 0;
                for (int dr = -1; dr <= 1; dr++)
                    for (int dc = -1; dc <= 1; dc++) {
                        if (dr == 0 && dc == 0) continue;
                        int nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc])
                            count++;
                    }
                adj[r][c] = count;
            }
        }
        return adj;
    }

    /** (r1,c1)이 (r2,c2)와 같거나 인접(8방향 포함 자기 자신)한지 확인 */
    private boolean isAdjacent(int r1, int c1, int r2, int c2) {
        return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
