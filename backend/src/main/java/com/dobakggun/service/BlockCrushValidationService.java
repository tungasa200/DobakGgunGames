package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Block Crush 점수 서버 검증 서비스.
 *
 * 비율안(B) 채택:
 *   score <= 1000 + linesCleared * 5000 + 240 * 9
 *
 *   근거:
 *   - 줄 제거 기본 점수: 줄당 최대 5,000 (4줄 동시=Tetris 보너스 포함)
 *   - 소프트/하드 드롭 보너스: 보드 높이(24) × 10 = 240
 *   - 콤보 보너스: 최대 9콤보 × 240 = 2160, 상수 240*9 로 흡수
 *   - 기본 점수 여유치: 1000
 */
@Service
public class BlockCrushValidationService {

    private static final int MAX_SCORE      = 9_999_999;
    private static final int MAX_LINES      = 100_000;
    private static final int BASE_ALLOWANCE = 1_000;
    // 줄 제거 1개당 최대 허용 점수 배율 (Tetris 보너스, 콤보 포함)
    private static final int SCORE_PER_LINE = 5_000;
    // 드롭 보너스 상한 (하드드롭 24행 × 10 × 최대콤보9 누적)
    private static final int DROP_BONUS_MAX = 240 * 9;

    public void validate(GameSession session, RankingRequest req) {
        Integer score       = req.getScore();
        Integer linesCleared = req.getLinesCleared();

        if (score == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }
        if (linesCleared == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }

        if (score < 0 || score > MAX_SCORE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }
        if (linesCleared < 0 || linesCleared > MAX_LINES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }

        // 비율 정합성: score > 1000 + linesCleared * 5000 + 240 * 9 이면 부정
        long maxAllowed = BASE_ALLOWANCE + (long) linesCleared * SCORE_PER_LINE + DROP_BONUS_MAX;
        if (score > maxAllowed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }
    }
}
