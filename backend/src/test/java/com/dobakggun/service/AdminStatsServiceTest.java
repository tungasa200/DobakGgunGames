package com.dobakggun.service;

import com.dobakggun.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStatsServiceTest {

    @Mock private MinesweeperRankingRepository minesweeperRankingRepository;
    @Mock private SolitaireRankingRepository solitaireRankingRepository;
    @Mock private AppleRankingRepository appleRankingRepository;
    @Mock private BaseballRankingRepository baseballRankingRepository;
    @Mock private BlockfallRankingRepository blockfallRankingRepository;
    @Mock private SudokuRankingRepository sudokuRankingRepository;
    @Mock private BrickBreakerRankingRepository brickBreakerRankingRepository;
    @Mock private BlockCrushRankingRepository blockCrushRankingRepository;
    @Mock private BlockfallInsaneRankingRepository blockfallInsaneRankingRepository;

    @InjectMocks
    private AdminStatsService sut;

    @Test
    @DisplayName("랭킹 수에 누락됐던 게임이 포함된다")
    void getRankingCounts_includesAddedGames() {
        when(brickBreakerRankingRepository.count()).thenReturn(1L);
        when(blockCrushRankingRepository.count()).thenReturn(2L);
        when(blockfallInsaneRankingRepository.count()).thenReturn(3L);

        List<Map<String, Object>> result = sut.getRankingCounts();

        assertThat(result).hasSize(9).contains(
                Map.of("game", "brickbreaker", "count", 1L),
                Map.of("game", "block-crush", "count", 2L),
                Map.of("game", "blockfall-insane", "count", 3L));
    }

    @Test
    @DisplayName("주간 합계에 누락됐던 게임의 기록이 더해진다")
    void getWeeklyRankingCounts_mergesAddedGames() {
        String monday = LocalDate.now().with(DayOfWeek.MONDAY).toString();
        when(brickBreakerRankingRepository.countByDayInWeek(any(), any()))
                .thenReturn(Collections.singletonList(new Object[]{monday, 1L}));
        when(blockCrushRankingRepository.countByDayInWeek(any(), any()))
                .thenReturn(Collections.singletonList(new Object[]{monday, 2L}));
        when(blockfallInsaneRankingRepository.countByDayInWeek(any(), any()))
                .thenReturn(Collections.singletonList(new Object[]{monday, 3L}));

        List<Map<String, Object>> result = sut.getWeeklyRankingCounts();

        assertThat(result).hasSize(7);
        assertThat(result.get(0)).containsEntry("date", monday).containsEntry("count", 6L);
    }
}
