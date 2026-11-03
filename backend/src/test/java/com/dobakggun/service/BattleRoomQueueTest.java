package com.dobakggun.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** T-44: 게임 중·결과 화면 방에 들어온 사람은 큐로 가고, 큐 사용자도 세션·퇴장 처리를 받는다. */
class BattleRoomQueueTest {

    private final BattleRoomManager manager = new BattleRoomManager();

    private BattleRoomManager.PlayerSessionInfo player(String id, String sessionId) {
        return new BattleRoomManager.PlayerSessionInfo(id, id, false, sessionId, 1L);
    }

    private void startedRoom() {
        manager.joinRoom("r1", player("1", "s-1"));
        manager.joinRoom("r1", player("2", "s-2"));
        assertThat(manager.closeToJoin("r1")).hasSize(2);
    }

    @Test
    @DisplayName("게임이 시작된 방에 들어오면 활성 참가자가 아니라 큐로 간다")
    void closedRoomQueuesNewcomer() {
        startedRoom();
        BattleRoomManager.PlayerSessionInfo late = player("3", null);

        assertThat(manager.joinRoom("r1", late)).isFalse();

        assertThat(late.isQueued()).isTrue();
        assertThat(manager.findActivePlayer("r1", "3")).isEmpty();
        assertThat(manager.getQueueSize("r1")).isEqualTo(1);
        assertThat(manager.findRoomIdByPlayerId("3")).contains("r1");
    }

    @Test
    @DisplayName("큐를 허용하지 않는 입장은 막히면 아무 데도 남지 않는다")
    void directJoinRejectedWithoutQueue() {
        startedRoom();

        assertThat(manager.joinRoom("r1", player("4", null), false)).isFalse();

        assertThat(manager.getQueueSize("r1")).isZero();
        assertThat(manager.findRoomIdByPlayerId("4")).isEmpty();
    }

    @Test
    @DisplayName("큐 사용자도 WS 세션이 등록되고 세션으로 퇴장 처리된다")
    void queuedPlayerSessionRegistered() {
        startedRoom();
        manager.joinRoom("r1", player("3", null));

        manager.registerSession("r1", "3", "s-3");

        assertThat(manager.getRoomIdBySession("s-3")).isEqualTo("r1");
        BattleRoomManager.PlayerSessionInfo removed = manager.removePlayer("s-3");
        assertThat(removed).isNotNull();
        assertThat(removed.getPlayerId()).isEqualTo("3");
        assertThat(manager.getQueueSize("r1")).isZero();
    }

    @Test
    @DisplayName("세션이 아직 없는 참가자가 있어도 세션 퇴장이 실패하지 않는다")
    void removeBySessionSkipsSessionless() {
        manager.joinRoom("r1", player("1", null));
        manager.joinRoom("r1", player("2", "s-2"));

        BattleRoomManager.PlayerSessionInfo removed = manager.removePlayer("s-2");

        assertThat(removed).isNotNull();
        assertThat(removed.getPlayerId()).isEqualTo("2");
        assertThat(manager.findActivePlayer("r1", "1")).isPresent();
    }

    @Test
    @DisplayName("다음 라운드 승격은 큐 사용자를 활성으로 옮기고 방을 다시 연다")
    void fillFromQueueReopens() {
        startedRoom();
        manager.joinRoom("r1", player("3", "s-3"));

        assertThat(manager.fillFromQueue("r1")).hasSize(1);

        BattleRoomManager.PlayerSessionInfo promoted = manager.findActivePlayer("r1", "3").orElseThrow();
        assertThat(promoted.isQueued()).isFalse();
        assertThat(manager.joinRoom("r1", player("4", "s-4"))).isTrue();
    }

    @Test
    @DisplayName("ID로 제거할 때 큐 사용자도 지운다")
    void removeByIdIncludesQueue() {
        startedRoom();
        manager.joinRoom("r1", player("3", "s-3"));

        assertThat(manager.removePlayerById("r1", "3")).isNotNull();

        assertThat(manager.getQueueSize("r1")).isZero();
        assertThat(manager.getRoomIdBySession("s-3")).isNull();
    }
}
