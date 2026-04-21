package com.dobakggun.service;

import com.dobakggun.dto.SudokuSessionStartResponse;
import com.dobakggun.entity.GameSession;
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

    private static final long EXPIRE_SECONDS  = 7200L;
    private static final Set<String> VALID_LEVELS = Set.of("easy", "normal", "hard");

    private final GameSessionRepository sessionRepo;
    private final IpHashUtil            ipHashUtil;
    private final ObjectMapper          objectMapper;

    /* ── 세션 생성 (퍼즐 생성 + 정답 서버 저장) ── */
    @Transactional
    public SudokuSessionStartResponse createSession(String level, HttpServletRequest httpReq) {
        validateLevel(level);

        int[][] solution = generateSolution();
        int[][] puzzle   = generatePuzzle(solution, level);

        String extra;
        try {
            extra = objectMapper.writeValueAsString(Map.of("solution", solution));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "세션 생성 오류");
        }

        Instant now       = Instant.now();
        String  sessionId = UUID.randomUUID().toString();
        String  ipHash    = ipHashUtil.hash(getClientIp(httpReq));

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
                .expiresAt(now.plusSeconds(EXPIRE_SECONDS).toEpochMilli())
                .puzzle(puzzle)
                .solution(solution)
                .build();
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

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
