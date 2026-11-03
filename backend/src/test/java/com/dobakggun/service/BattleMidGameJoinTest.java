package com.dobakggun.service;

import com.dobakggun.dto.battle.BattleEnvelope;
import com.dobakggun.dto.battle.BattleJoinResponse;
import com.dobakggun.dto.battle.RoomStatePayload;
import com.dobakggun.entity.battle.BattleRoom;
import com.dobakggun.repository.BattleRoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** T-44 게임 중 입장은 큐로, T-46(1) 결과 화면 퇴장 뒤 다음 라운드·빈 방 정리. */
class BattleMidGameJoinTest {

    private final BattleRoomManager roomManager = new BattleRoomManager();
    private final BattleRoomRepository repository = mock(BattleRoomRepository.class);
    private final GameStatusService gameStatusService = mock(GameStatusService.class);
    private final ThreadPoolTaskScheduler taskScheduler = mock(ThreadPoolTaskScheduler.class);
    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    private final BattleRoomService service = new BattleRoomService(
            roomManager, repository, mock(BattleRankingService.class), gameStatusService, taskScheduler);

    private final BattleRoom room = BattleRoom.builder().roomId("r1").status("WAITING").maxPlayers(5).build();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);
        when(repository.findByRoomId("r1")).thenReturn(Optional.of(room));
        ScheduledFuture<?> future = mock(ScheduledFuture.class);
        when(future.getDelay(TimeUnit.MILLISECONDS)).thenReturn(10_000L);
        doReturn(future).when(taskScheduler).schedule(any(Runnable.class), any(Instant.class));
    }

    private void join(String id) {
        roomManager.joinRoom("r1", new BattleRoomManager.PlayerSessionInfo(id, id, false, "s-" + id, 1L));
    }

    private void playingRoomWithLateJoiner() {
        join("1");
        join("2");
        service.startGame("r1");
        assertThat(room.getStatus()).isEqualTo("PLAYING");
        when(repository.findFirstByStatus(eq("PLAYING"), any(Sort.class))).thenReturn(Optional.of(room));

        BattleJoinResponse response = service.joinBattle(3L, null, false, "late");

        assertThat(response.getQueuePosition()).isEqualTo(1);
        assertThat(response.getStatus()).isEqualTo("PLAYING");
    }

    @Test
    @DisplayName("게임 중 입장은 큐로 가고, 큐 사용자의 게임오버 신호는 순위를 만들지 않는다")
    void midGameJoinQueued() {
        playingRoomWithLateJoiner();

        assertThat(roomManager.findActivePlayer("r1", "3")).isEmpty();
        assertThat(roomManager.getAlivePlayers("r1")).hasSize(2);

        service.handlePlayerFinished("r1", "3", 100);

        assertThat(roomManager.getAlivePlayers("r1")).hasSize(2);
        assertThat(room.getStatus()).isEqualTo("PLAYING");
    }

    @Test
    @DisplayName("큐가 있으면 결과 화면에서 10초 자동 승격을 예약하고, 실행되면 큐 사용자가 다음 라운드에 들어간다")
    void queuePromotedAfterResult() {
        playingRoomWithLateJoiner();

        service.handlePlayerFinished("r1", "1", 0);   // 2명 중 1명 탈락 → 게임 종료
        assertThat(room.getStatus()).isEqualTo("FINISHED");

        ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/blockfall-battle/room/r1"), sent.capture());
        RoomStatePayload lastState = sent.getAllValues().stream()
                .map(BattleEnvelope.class::cast)
                .filter(e -> "ROOM_STATE".equals(e.getType()))
                .map(e -> (RoomStatePayload) e.getPayload())
                .reduce((a, b) -> b)
                .orElseThrow();
        assertThat(lastState.getStatus()).isEqualTo("FINISHED");
        assertThat(lastState.getNextRoundInSeconds()).isBetween(1, BattleRoomService.AUTO_NEXT_ROUND_SECONDS);

        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, atLeastOnce()).schedule(task.capture(), any(Instant.class));
        List<Runnable> tasks = task.getAllValues();
        tasks.get(tasks.size() - 1).run();

        assertThat(room.getStatus()).isEqualTo("WAITING");
        BattleRoomManager.PlayerSessionInfo promoted = roomManager.findActivePlayer("r1", "3").orElseThrow();
        assertThat(promoted.isQueued()).isFalse();
        assertThat(roomManager.getQueueSize("r1")).isZero();
    }

    @Test
    @DisplayName("자동 승격 시각에 게임이 꺼져 있으면 승격하지 않고 다시 예약한다")
    void disabledTimerReschedules() {
        playingRoomWithLateJoiner();
        service.handlePlayerFinished("r1", "1", 0);
        when(gameStatusService.isDisabled("blockfall-battle")).thenReturn(true);

        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, times(1)).schedule(task.capture(), any(Instant.class));
        task.getValue().run();

        assertThat(room.getStatus()).isEqualTo("FINISHED");
        assertThat(roomManager.getQueueSize("r1")).isEqualTo(1);
        verify(taskScheduler, times(2)).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    @DisplayName("결과 화면에서 준비하지 않은 사람이 나가면, 남은 사람이 모두 준비했을 때 다음 라운드가 열린다")
    void unreadyLeaverStartsNextRound() {
        join("1");
        join("2");
        join("3");
        service.finishGame("r1");
        service.handlePlayerReady("r1", "1");
        service.handlePlayerReady("r1", "2");
        assertThat(room.getStatus()).isEqualTo("FINISHED");

        service.handleExplicitLeave("s-3");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
    }

    @Test
    @DisplayName("결과 화면에서 모두 나가면 방을 닫는다")
    void emptyFinishedRoomClosed() {
        join("1");
        service.finishGame("r1");

        service.handleExplicitLeave("s-1");

        assertThat(room.getClosedAt()).isNotNull();
        assertThat(roomManager.getActiveRoomCount()).isZero();
        verify(messagingTemplate, never())
                .convertAndSendToUser(anyString(), eq("/queue/blockfall-battle/errors"), any(Object.class));
    }
}
