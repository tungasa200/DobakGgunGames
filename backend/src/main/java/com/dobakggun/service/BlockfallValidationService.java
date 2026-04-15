package com.dobakggun.service;

import com.dobakggun.dto.RankingRequest;
import com.dobakggun.entity.GameSession;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BlockfallValidationService {

    // 레벨 1당 10줄 클리어 시 레벨업
    private static final int LINES_PER_LEVEL = 10;
    // 4줄 동시 제거(테트리스) 기준 최대 점수: 800 * gameLevel
    // T-스핀까지 감안하면 1600 * gameLevel, 콤보 보너스 포함 여유값으로 ×3 적용
    private static final int MAX_SCORE_MULTIPLIER = 3;

    public void validate(GameSession session, RankingRequest req) {
        Integer score = req.getScore();
        Integer linesCleared = req.getLinesCleared();
        Integer gameLevel = req.getGameLevel();

        if (score == null || linesCleared == null || gameLevel == null) return;

        // 1. gameLevel 도달 가능 여부: (gameLevel-1) × 10줄 이상 클리어해야 함
        int minLinesForLevel = (gameLevel - 1) * LINES_PER_LEVEL;
        if (linesCleared < minLinesForLevel) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "레벨 대비 줄 수 정보가 유효하지 않습니다.");
        }

        // 2. 점수 상한: linesCleared × 800 × gameLevel × MAX_SCORE_MULTIPLIER
        //    (T-스핀, 콤보 포함 매우 관대한 상한)
        long maxScore = (long) linesCleared * 800 * gameLevel * MAX_SCORE_MULTIPLIER;
        if (score > maxScore) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "점수가 유효 범위를 초과했습니다.");
        }
    }
}
