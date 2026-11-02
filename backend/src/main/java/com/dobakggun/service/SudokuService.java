package com.dobakggun.service;

import com.dobakggun.dto.SudokuCompleteRequest;
import com.dobakggun.dto.SudokuCompleteResponse;
import com.dobakggun.dto.SudokuHintRequest;
import com.dobakggun.dto.SudokuHintResponse;
import com.dobakggun.dto.SudokuSessionStartResponse;
import com.dobakggun.entity.GameSession;
import com.dobakggun.exception.GamePlayErrorCode;
import com.dobakggun.exception.GamePlayException;
import com.dobakggun.repository.GameSessionRepository;
import com.dobakggun.util.IpHashUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SudokuService {

    private static final Set<String> VALID_LEVELS = Set.of("easy", "normal", "hard");
    private static final int MAX_HINTS = 3;

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;
    private final PlaySessionSupport    playSupport;

    /* ── 세션 생성 (퍼즐 생성 + 정답 서버 저장) ── */
    @Transactional
    public SudokuSessionStartResponse createSession(String level, HttpServletRequest httpReq) {
        validateLevel(level);

        int[][] solution = generateSolution();
        int[][] puzzle   = generatePuzzle(solution, level);

        String extra;
        try {
            extra = objectMapper.writeValueAsString(Map.of("solution", solution, "puzzle", puzzle));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 생성 오류");
        }

        Instant now       = Instant.now();
        String  sessionId = UUID.randomUUID().toString();
        String  ipHash    = ipHashUtil.hash(PlaySessionSupport.getClientIp(httpReq));

        sessionRepo.save(GameSession.builder()
                .sessionId(sessionId)
                .game("sudoku")
                .level(level)
                .ipHash(ipHash)
                .startedAt(now)
                .extra(extra)
                .build());

        return SudokuSessionStartResponse.builder()
                .sessionId(sessionId)
                .startedAt(now.toEpochMilli())
                .expiresAt(now.plusSeconds(PlaySessionSupport.EXPIRE_SECONDS).toEpochMilli())
                .puzzle(puzzle)
                .solution(solution)
                .build();
    }

    /* ── 힌트: 값은 서버가 주고, 셀 선택은 클라이언트가 한다 ── */
    @Transactional(noRollbackFor = GamePlayException.class)  // 실패 요청의 IP 불일치 기록을 남긴다
    public SudokuHintResponse hint(String sessionId, SudokuHintRequest req, HttpServletRequest httpReq) {
        GameSession session = playSupport.lockSession(sessionId, "sudoku", httpReq);
        playSupport.requireActive(session);

        Map<String, Object> extra = playSupport.readExtra(session);
        if (extra.containsKey(PlaySessionSupport.CLEAR_TIME_MS)) {
            throw new GamePlayException(GamePlayErrorCode.GAME_ENDED);
        }
        Integer row = req.getRow(), col = req.getCol();
        if (row == null || col == null || row < 0 || row > 8 || col < 0 || col > 8) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }
        int hintsUsed = extra.get("hintsUsed") instanceof Number used ? used.intValue() : 0;
        int cell = row * 9 + col;
        List<Object> hintedCells = extra.get("hintedCells") instanceof List<?> cells
            ? new ArrayList<>(cells) : new ArrayList<>();

        // 주어진 칸과 이미 받은 칸은 새로 알려 주는 것이 없으므로 차감하지 않는다 (응답 유실 재시도 포함)
        if (!hintedCells.contains(cell) && !isGiven(extra, row, col)) {
            if (hintsUsed >= MAX_HINTS) {
                throw new GamePlayException(GamePlayErrorCode.HINT_EXHAUSTED);
            }
            extra.put("hintsUsed", ++hintsUsed);
            hintedCells.add(cell);
            extra.put("hintedCells", hintedCells);
            playSupport.saveExtra(session, extra);
        }

        int[][] solution = playSupport.convert(extra.get("solution"), int[][].class);
        return new SudokuHintResponse(row, col, solution[row][col], MAX_HINTS - hintsUsed);
    }

    /** puzzle 저장 전에 시작한 세션은 주어진 칸을 알 수 없어 false다. */
    private boolean isGiven(Map<String, Object> extra, int row, int col) {
        Object puzzle = extra.get("puzzle");
        return puzzle != null && playSupport.convert(puzzle, int[][].class)[row][col] != 0;
    }

    /* ── 클리어 판정: 이 시점의 서버 경과 시간이 기록이 된다 ── */
    @Transactional(noRollbackFor = GamePlayException.class)  // 실패 요청의 IP 불일치 기록을 남긴다
    public SudokuCompleteResponse complete(String sessionId, SudokuCompleteRequest req, HttpServletRequest httpReq) {
        GameSession session = playSupport.lockSession(sessionId, "sudoku", httpReq);

        Map<String, Object> extra = playSupport.readExtra(session);
        if (extra.get(PlaySessionSupport.CLEAR_TIME_MS) instanceof Number clearTimeMs) {
            return new SudokuCompleteResponse(true, clearTimeMs.longValue());
        }
        playSupport.requireActive(session);

        int[][] board = req.getBoard();
        if (board == null || board.length != 9
                || Arrays.stream(board).anyMatch(row -> row == null || row.length != 9)) {
            throw new GamePlayException(GamePlayErrorCode.INVALID_CELL);
        }
        // 유일해가 보장되므로 solution과 같으면 충분하다
        int[][] solution = playSupport.convert(extra.get("solution"), int[][].class);
        if (!Arrays.deepEquals(solution, board)) {
            throw new GamePlayException(GamePlayErrorCode.BOARD_INCORRECT);
        }

        long clearTimeMs = playSupport.elapsedMs(session);
        extra.put(PlaySessionSupport.CLEAR_TIME_MS, clearTimeMs);
        playSupport.saveExtra(session, extra);
        return new SudokuCompleteResponse(true, clearTimeMs);
    }

    public static void validateLevel(String level) {
        if (!VALID_LEVELS.contains(level)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 레벨입니다.");
        }
    }

    // ─── 퍼즐 생성 ─────────────────────────────────────────────────────

    /** 완성된 9×9 그리드를 백트래킹으로 생성 */
    private int[][] generateSolution() {
        int[][] grid = new int[9][9];
        fillGrid(grid);
        return grid;
    }

    private boolean fillGrid(int[][] grid) {
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (grid[r][c] == 0) {
                    List<Integer> nums = new ArrayList<>(Arrays.asList(1,2,3,4,5,6,7,8,9));
                    Collections.shuffle(nums);
                    for (int num : nums) {
                        if (isValid(grid, r, c, num)) {
                            grid[r][c] = num;
                            if (fillGrid(grid)) return true;
                            grid[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    /** 완성 그리드에서 셀을 제거해 퍼즐 생성 (유일해 보장) */
    private int[][] generatePuzzle(int[][] solution, String level) {
        int removals = switch (level) {
            case "easy"   -> 36;
            case "normal" -> 46;
            case "hard"   -> 52;
            default       -> 36;
        };

        int[][] puzzle = new int[9][9];
        for (int i = 0; i < 9; i++) puzzle[i] = solution[i].clone();

        List<int[]> cells = new ArrayList<>();
        for (int r = 0; r < 9; r++)
            for (int c = 0; c < 9; c++)
                cells.add(new int[]{r, c});
        Collections.shuffle(cells);

        int removed = 0;
        for (int[] cell : cells) {
            if (removed >= removals) break;
            int backup = puzzle[cell[0]][cell[1]];
            puzzle[cell[0]][cell[1]] = 0;
            if (countSolutions(copyGrid(puzzle), 2) == 1) {
                removed++;
            } else {
                puzzle[cell[0]][cell[1]] = backup;
            }
        }
        return puzzle;
    }

    /** 해의 수를 세되, limit 개에 도달하면 즉시 반환 (효율화) */
    private int countSolutions(int[][] grid, int limit) {
        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (grid[r][c] == 0) {
                    int count = 0;
                    for (int num = 1; num <= 9; num++) {
                        if (isValid(grid, r, c, num)) {
                            grid[r][c] = num;
                            count += countSolutions(grid, limit - count);
                            grid[r][c] = 0;
                            if (count >= limit) return count;
                        }
                    }
                    return count;
                }
            }
        }
        return 1;
    }

    private boolean isValid(int[][] grid, int r, int c, int num) {
        for (int j = 0; j < 9; j++) if (grid[r][j] == num) return false;
        for (int i = 0; i < 9; i++) if (grid[i][c] == num) return false;
        int boxR = r - r % 3, boxC = c - c % 3;
        for (int i = boxR; i < boxR + 3; i++)
            for (int j = boxC; j < boxC + 3; j++)
                if (grid[i][j] == num) return false;
        return true;
    }

    private int[][] copyGrid(int[][] grid) {
        int[][] copy = new int[9][9];
        for (int i = 0; i < 9; i++) copy[i] = grid[i].clone();
        return copy;
    }
}
