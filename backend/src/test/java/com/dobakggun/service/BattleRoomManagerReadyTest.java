package com.dobakggun.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 나간 멤버의 준비가 남으면 남은 사람이 준비하기 전에 다음 라운드가 열린다. */
class BattleRoomManagerReadyTest {

    private final BattleRoomManager manager = new BattleRoomManager();

    private void join(String playerId) {
        manager.joinRoom("r1", new BattleRoomManager.PlayerSessionInfo(playerId, playerId, false, "s-" + playerId, 1L));
    }

    @Test
    void 준비_후_세션으로_나간_멤버는_준비_수에서_빠진다() {
        join("a");
        join("b");
        join("c");
        manager.markPlayerReady("r1", "a");

        manager.removePlayer("s-a");

        assertThat(manager.markPlayerReady("r1", "b")).isFalse();
        assertThat(manager.getReadyCount("r1")).isEqualTo(1);
        assertThat(manager.markPlayerReady("r1", "c")).isTrue();
    }

    @Test
    void 준비_후_ID로_제거된_멤버는_준비_수에서_빠진다() {
        join("a");
        join("b");
        join("c");
        manager.markPlayerReady("r1", "a");

        manager.removePlayerById("r1", "a");

        assertThat(manager.markPlayerReady("r1", "b")).isFalse();
        assertThat(manager.getReadyCount("r1")).isEqualTo(1);
    }
}
