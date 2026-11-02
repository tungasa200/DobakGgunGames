package com.dobakggun.service;

import com.dobakggun.entity.BlockCrushRanking;
import com.dobakggun.entity.BlockfallInsaneRanking;
import com.dobakggun.entity.BrickBreakerRanking;
import com.dobakggun.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminRankingServiceTest {

    private static final Pageable PAGE = PageRequest.of(0, 50);

    @Mock private AppleRankingRepository appleRepo;
    @Mock private BaseballRankingRepository baseballRepo;
    @Mock private MinesweeperRankingRepository minesweeperRepo;
    @Mock private SolitaireRankingRepository solitaireRepo;
    @Mock private BlockfallRankingRepository blockfallRepo;
    @Mock private SudokuRankingRepository sudokuRepo;
    @Mock private BrickBreakerRankingRepository brickBreakerRepo;
    @Mock private BlockCrushRankingRepository blockCrushRepo;
    @Mock private BlockfallInsaneRankingRepository blockfallInsaneRepo;

    @InjectMocks
    private AdminRankingService sut;

    @Test
    @DisplayName("누락됐던 게임의 목록을 조회한다")
    void getList_addedGames() {
        Page<BrickBreakerRanking> brickBreaker = new PageImpl<>(List.of(new BrickBreakerRanking()));
        Page<BlockCrushRanking> blockCrush = new PageImpl<>(List.of(new BlockCrushRanking()));
        Page<BlockfallInsaneRanking> insane = new PageImpl<>(List.of(new BlockfallInsaneRanking()));
        when(brickBreakerRepo.findFiltered(null, null, null, PAGE)).thenReturn(brickBreaker);
        when(blockCrushRepo.findFiltered(null, null, null, PAGE)).thenReturn(blockCrush);
        when(blockfallInsaneRepo.findFiltered(null, null, null, PAGE)).thenReturn(insane);

        assertThat(sut.getList("brickbreaker", null, null, null, PAGE).getContent()).hasSize(1);
        assertThat(sut.getList("block-crush", null, null, null, PAGE).getContent()).hasSize(1);
        assertThat(sut.getList("blockfall-insane", null, null, null, PAGE).getContent()).hasSize(1);
    }

    @Test
    @DisplayName("누락됐던 게임의 기록을 하나씩 삭제한다")
    void deleteOne_addedGames() {
        when(brickBreakerRepo.existsById(1L)).thenReturn(true);
        when(blockCrushRepo.existsById(2L)).thenReturn(true);
        when(blockfallInsaneRepo.existsById(3L)).thenReturn(true);

        sut.deleteOne("brickbreaker", 1L);
        sut.deleteOne("block-crush", 2L);
        sut.deleteOne("blockfall-insane", 3L);

        verify(brickBreakerRepo).deleteById(1L);
        verify(blockCrushRepo).deleteById(2L);
        verify(blockfallInsaneRepo).deleteById(3L);
    }

    @Test
    @DisplayName("없는 기록을 삭제하면 404")
    void deleteOne_missingRecord() {
        when(blockCrushRepo.existsById(9L)).thenReturn(false);

        assertThatThrownBy(() -> sut.deleteOne("block-crush", 9L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("누락됐던 게임의 기록을 전체 삭제한다")
    void deleteAll_addedGames() {
        sut.deleteAll("brickbreaker");
        sut.deleteAll("block-crush");
        sut.deleteAll("blockfall-insane");

        verify(brickBreakerRepo).deleteAll();
        verify(blockCrushRepo).deleteAll();
        verify(blockfallInsaneRepo).deleteAll();
    }

    @Test
    @DisplayName("리더보드는 게임의 실제 레벨로 조회한다")
    void getLeaderboard_usesRealLevels() {
        when(blockCrushRepo.findPreviousWeekTop3(eq("classic"), any(), any())).thenReturn(List.of());
        when(blockfallInsaneRepo.findPreviousWeekTop3(eq("hard"), any(), any())).thenReturn(List.of());
        when(brickBreakerRepo.findPreviousWeekTop3(eq("normal"), any(), any())).thenReturn(List.of());

        assertThat(sut.getLeaderboard("block-crush").get("levels")).isEqualTo(List.of("classic"));
        assertThat(sut.getLeaderboard("blockfall-insane").get("levels")).isEqualTo(List.of("hard"));
        assertThat(sut.getLeaderboard("brickbreaker").get("levels")).isEqualTo(List.of("normal"));
    }

    @Test
    @DisplayName("모르는 게임은 400")
    void getList_unknownGame() {
        assertThatThrownBy(() -> sut.getList("nope", null, null, null, PAGE))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
