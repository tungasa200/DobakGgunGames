package com.dobakggun.service;

import com.dobakggun.dto.rsp.RspPlayResponse;
import com.dobakggun.dto.rsp.RspStatsResponse;
import com.dobakggun.entity.AdminRspPlay;
import com.dobakggun.entity.RspChoice;
import com.dobakggun.entity.RspResult;
import com.dobakggun.repository.AdminRspPlayRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class AdminRspService {

    private static final RspChoice[] CHOICES = RspChoice.values();

    private final AdminRspPlayRepository adminRspPlayRepository;

    /**
     * 판 진행: 랜덤 computerChoice 생성 → 판정 → 저장 → 결과 + 최신 통계 반환
     */
    @Transactional
    public RspPlayResponse play(Long adminUserId, RspChoice userChoice) {
        RspChoice computerChoice = randomChoice();
        RspResult result = judge(userChoice, computerChoice);

        AdminRspPlay play = AdminRspPlay.builder()
                .adminUserId(adminUserId)
                .userChoice(userChoice)
                .computerChoice(computerChoice)
                .result(result)
                .build();

        AdminRspPlay saved = adminRspPlayRepository.save(play);

        // 저장 직후 최신 통계를 함께 반환 (RTT 절약 — OQ-1 확정)
        RspStatsResponse stats = buildStats(adminUserId);
        return RspPlayResponse.of(saved, stats);
    }

    /**
     * 어드민 본인 누적 통계 조회
     */
    @Transactional(readOnly = true)
    public RspStatsResponse getStats(Long adminUserId) {
        return buildStats(adminUserId);
    }

    // ─── 내부 헬퍼 ────────────────────────────────────────────────────────────

    /**
     * ThreadLocalRandom으로 컴퓨터 선택 생성 (OQ-6 확정)
     */
    private RspChoice randomChoice() {
        int idx = ThreadLocalRandom.current().nextInt(CHOICES.length);
        return CHOICES[idx];
    }

    /**
     * 판정 로직 — 서버 SSOT (PRD §5 판정 테이블 기준)
     *
     * user \ computer | ROCK     | SCISSORS | PAPER
     * ROCK            | DRAW     | WIN      | LOSS
     * SCISSORS        | LOSS     | DRAW     | WIN
     * PAPER           | WIN      | LOSS     | DRAW
     */
    RspResult judge(RspChoice userChoice, RspChoice computerChoice) {
        if (userChoice == computerChoice) {
            return RspResult.DRAW;
        }
        return switch (userChoice) {
            case ROCK     -> computerChoice == RspChoice.SCISSORS ? RspResult.WIN : RspResult.LOSS;
            case SCISSORS -> computerChoice == RspChoice.PAPER    ? RspResult.WIN : RspResult.LOSS;
            case PAPER    -> computerChoice == RspChoice.ROCK     ? RspResult.WIN : RspResult.LOSS;
        };
    }

    /**
     * 집계 쿼리 결과로 RspStatsResponse 빌드.
     * winRate: 0~1 소수 4자리 반올림, totalPlays=0이면 null (OQ-7 / EC-6 확정)
     */
    private RspStatsResponse buildStats(Long adminUserId) {
        Object[] row = adminRspPlayRepository.aggregateStatsByAdminUserId(adminUserId);

        long totalPlays = row[0] != null ? ((Number) row[0]).longValue() : 0L;
        long wins       = row[1] != null ? ((Number) row[1]).longValue() : 0L;
        long losses     = row[2] != null ? ((Number) row[2]).longValue() : 0L;
        long draws      = row[3] != null ? ((Number) row[3]).longValue() : 0L;

        BigDecimal winRate = null;
        if (totalPlays > 0) {
            winRate = BigDecimal.valueOf(wins)
                    .divide(BigDecimal.valueOf(totalPlays), 4, RoundingMode.HALF_UP);
        }

        return RspStatsResponse.builder()
                .totalPlays(totalPlays)
                .wins(wins)
                .losses(losses)
                .draws(draws)
                .winRate(winRate)
                .build();
    }
}
