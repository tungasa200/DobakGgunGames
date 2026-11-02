package com.dobakggun.service;

import com.dobakggun.dto.MinesweeperPlayStartResponse;
import com.dobakggun.dto.MinesweeperRevealRequest;
import com.dobakggun.dto.MinesweeperRevealResponse;
import com.dobakggun.dto.MinesweeperRevealResponse.RevealedCell;
import com.dobakggun.dto.MinesweeperSessionStartRequest;
import com.dobakggun.dto.MinesweeperStateResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.util.IpHashUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * 지뢰찾기 서버 판정(protocol 2). 지뢰 위치는 패배 응답 전까지 내려보내지 않는다.
 * 구경로(MinesweeperSessionService)와 분리되어 있어, 이 경로를 끄면 기존 흐름으로 돌아간다.
 * 열기 규칙은 프론트 useMinesweeperGame의 revealCells와 같다.
 */
@Service
@RequiredArgsConstructor
public class MinesweeperPlayService {

    private static final String PLAYING = "PLAYING";
    private static final String WON     = "WON";
    private static final String LOST    = "LOST";
    private static final int MAX_CELLS_PER_REVEAL = 8;

    private final IpHashUtil         ipHashUtil;
    private final PlaySessionSupport support;

    @Transactional
    public MinesweeperPlayStartResponse createSession(MinesweeperSessionStartRequest req,
                                                      HttpServletRequest httpReq) {
        int[] preset = MinesweeperSessionService.PRESETS.get(req.getLevel());
        if (preset == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 레벨입니다.");
        }
        int rows = preset[0], cols = preset[1], mines = preset[2];

        Integer firstR = req.getFirstClickR(), firstC = req.getFirstClickC();
        if (firstR == null || firstC == null || !inBounds(firstR, firstC, rows, cols)) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }

        boolean[][] grid = MinesweeperSessionService.generateMines(rows, cols, mines, firstR, firstC);
        int[][] adj = MinesweeperSessionService.computeAdjMines(grid, rows, cols);

        List<int[]> minePositions = new ArrayList<>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (grid[r][c]) minePositions.add(new int[]{r, c});

        Instant now = Instant.now();
        String sessionId = UUID.randomUUID().toString();
        GameSession session = GameSession.builder()
            .sessionId(sessionId)
            .game("minesweeper")
            .level(req.getLevel())
            .ipHash(ipHashUtil.hash(PlaySessionSupport.getClientIp(httpReq)))
            .startedAt(now)
            .build();

        BitSet revealed = new BitSet(rows * cols);
        List<RevealedCell> opened = new ArrayList<>();
        open(adj, revealed, new boolean[rows][cols], firstR, firstC, opened);
        boolean won = revealed.cardinality() == rows * cols - mines;
        String status = won ? WON : PLAYING;

        Map<String, Object> extra = new HashMap<>();
        extra.put("protocol",      PlaySessionSupport.PROTOCOL);
        extra.put("rows",          rows);
        extra.put("cols",          cols);
        extra.put("minePositions", minePositions);
        extra.put("revealed",      encode(revealed));
        extra.put("status",        status);
        if (won) extra.put(PlaySessionSupport.CLEAR_TIME_MS, 0L);
        support.saveExtra(session, extra);

        return new MinesweeperPlayStartResponse(
            sessionId, now.toEpochMilli(), now.plusSeconds(PlaySessionSupport.EXPIRE_SECONDS).toEpochMilli(),
            rows, cols, mines, status, opened);
    }

    @Transactional(noRollbackFor = GamePlayException.class)  // 실패 요청의 IP 불일치 기록을 남긴다
    public MinesweeperRevealResponse reveal(String sessionId, MinesweeperRevealRequest req,
                                            HttpServletRequest httpReq) {
        GameSession session = support.lockSession(sessionId, "minesweeper", httpReq);
        support.requireActive(session);

        Map<String, Object> extra = support.readExtra(session);
        if (!PlaySessionSupport.isServerJudged(extra)) {
            throw new GamePlayException(GamePlayErrorCode.SESSION_INVALID);
        }
        if (!PLAYING.equals(extra.get("status"))) {
            throw new GamePlayException(GamePlayErrorCode.GAME_ENDED);
        }

        int rows = (Integer) extra.get("rows");
        int cols = (Integer) extra.get("cols");
        boolean[][] flags = parseFlags(req.getFlags(), rows, cols);
        List<int[]> cells = req.getCells();
        requireCells(cells, rows, cols);

        int[][] mines = support.convert(extra.get("minePositions"), int[][].class);
        boolean[][] grid = mineGrid(mines, rows, cols);
        int[][] adj = MinesweeperSessionService.computeAdjMines(grid, rows, cols);

        BitSet revealed = decode((String) extra.get("revealed"));
        List<RevealedCell> opened = new ArrayList<>();
        String status = PLAYING;
        for (int[] cell : cells) {
            int r = cell[0], c = cell[1];
            // 이미 연 칸은 open()이 무시하므로 재시도해도 판은 바뀌지 않는다 (응답에는 새로 열린 칸만 담긴다)
            if (grid[r][c] && !flags[r][c]) {
                status = LOST;
                break;
            }
            open(adj, revealed, flags, r, c, opened);
        }

        Long clearTimeMs = null;
        if (PLAYING.equals(status) && revealed.cardinality() == rows * cols - mines.length) {
            status = WON;
            clearTimeMs = support.elapsedMs(session);
            extra.put(PlaySessionSupport.CLEAR_TIME_MS, clearTimeMs);
        }

        extra.put("revealed", encode(revealed));
        extra.put("status",   status);
        support.saveExtra(session, extra);

        return new MinesweeperRevealResponse(status, opened, LOST.equals(status) ? mines : null, clearTimeMs);
    }

    /** 응답을 잃은 프론트가 현재 판을 복구한다. 종료된 판은 제출 뒤에도 세션이 삭제될 때까지 읽을 수 있다. */
    @Transactional(readOnly = true)
    public MinesweeperStateResponse state(String sessionId) {
        GameSession session = support.readSession(sessionId, "minesweeper");
        Map<String, Object> extra = support.readExtra(session);
        if (!PlaySessionSupport.isServerJudged(extra)) {
            throw new GamePlayException(GamePlayErrorCode.SESSION_INVALID);
        }
        String status = (String) extra.get("status");
        if (PLAYING.equals(status)) {
            support.requireActive(session);
        }

        int rows = (Integer) extra.get("rows");
        int cols = (Integer) extra.get("cols");
        int[][] mines = support.convert(extra.get("minePositions"), int[][].class);
        int[][] adj = MinesweeperSessionService.computeAdjMines(mineGrid(mines, rows, cols), rows, cols);

        BitSet revealed = decode((String) extra.get("revealed"));
        List<RevealedCell> cells = revealed.stream()
            .mapToObj(i -> new RevealedCell(i / cols, i % cols, adj[i / cols][i % cols]))
            .toList();

        Instant startedAt = session.getStartedAt();
        return new MinesweeperStateResponse(
            status, rows, cols, mines.length, startedAt.toEpochMilli(),
            startedAt.plusSeconds(PlaySessionSupport.EXPIRE_SECONDS).toEpochMilli(), cells,
            LOST.equals(status) ? mines : null,
            extra.get(PlaySessionSupport.CLEAR_TIME_MS) instanceof Number ms ? ms.longValue() : null);
    }

    private boolean[][] mineGrid(int[][] mines, int rows, int cols) {
        boolean[][] grid = new boolean[rows][cols];
        for (int[] m : mines) grid[m[0]][m[1]] = true;
        return grid;
    }

    /** 지뢰가 아닌 칸을 연다. 0인 칸은 주변으로 번지고, 깃발 칸에서 멈춘다. */
    private void open(int[][] adj, BitSet revealed, boolean[][] flags, int startR, int startC,
                      List<RevealedCell> opened) {
        int rows = adj.length, cols = adj[0].length;
        Deque<int[]> stack = new ArrayDeque<>();
        stack.push(new int[]{startR, startC});

        while (!stack.isEmpty()) {
            int[] cell = stack.pop();
            int r = cell[0], c = cell[1];
            if (!inBounds(r, c, rows, cols) || flags[r][c] || adj[r][c] < 0) continue;

            int index = r * cols + c;
            if (revealed.get(index)) continue;
            revealed.set(index);
            opened.add(new RevealedCell(r, c, adj[r][c]));

            if (adj[r][c] == 0) {
                for (int dr = -1; dr <= 1; dr++)
                    for (int dc = -1; dc <= 1; dc++)
                        if (dr != 0 || dc != 0) stack.push(new int[]{r + dr, c + dc});
            }
        }
    }

    private void requireCells(List<int[]> cells, int rows, int cols) {
        if (cells == null || cells.isEmpty() || cells.size() > MAX_CELLS_PER_REVEAL) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }
        cells.forEach(cell -> requireCell(cell, rows, cols));
    }

    private boolean[][] parseFlags(List<int[]> flags, int rows, int cols) {
        boolean[][] grid = new boolean[rows][cols];
        if (flags == null) return grid;
        if (flags.size() > rows * cols) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }
        for (int[] flag : flags) {
            requireCell(flag, rows, cols);
            grid[flag[0]][flag[1]] = true;
        }
        return grid;
    }

    private void requireCell(int[] cell, int rows, int cols) {
        if (cell == null || cell.length != 2 || !inBounds(cell[0], cell[1], rows, cols)) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }
    }

    private boolean inBounds(int r, int c, int rows, int cols) {
        return r >= 0 && r < rows && c >= 0 && c < cols;
    }

    private String encode(BitSet bits) {
        return Base64.getEncoder().encodeToString(bits.toByteArray());
    }

    private BitSet decode(String value) {
        return BitSet.valueOf(Base64.getDecoder().decode(value));
    }
}
