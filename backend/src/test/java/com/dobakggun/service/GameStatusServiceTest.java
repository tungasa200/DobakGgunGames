package com.dobakggun.service;

import com.dobakggun.entity.GameStatus;
import com.dobakggun.repository.GameStatusRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameStatusServiceTest {

    @Mock
    private GameStatusRepository repo;

    @InjectMocks
    private GameStatusService sut;

    @ParameterizedTest
    @ValueSource(strings = {"block-crush", "blockfall-insane"})
    @DisplayName("누락됐던 게임도 기본 행이 활성 상태로 만들어진다")
    void initDefaults_seedsPreviouslyMissingGames(String gameKey) {
        when(repo.existsById(anyString())).thenReturn(false);

        sut.initDefaults();

        ArgumentCaptor<GameStatus> saved = ArgumentCaptor.forClass(GameStatus.class);
        verify(repo, atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues())
                .filteredOn(gs -> gs.getGameKey().equals(gameKey))
                .singleElement()
                .satisfies(gs -> assertThat(gs.isActive()).isTrue());
    }

    @Test
    @DisplayName("이미 있는 행은 덮어쓰지 않아 관리자가 끈 상태가 재시작에도 유지된다")
    void initDefaults_keepsExistingRows() {
        when(repo.existsById(anyString())).thenReturn(true);

        sut.initDefaults();

        verify(repo, never()).save(any());
    }
}
