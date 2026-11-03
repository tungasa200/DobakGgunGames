package com.dobakggun.service;

import com.dobakggun.dto.battle.BattleEnvelope;
import com.dobakggun.dto.battle.BattleJoinResponse;
import com.dobakggun.dto.battle.GameStartedPayload;
import com.dobakggun.dto.battle.PlayerInfo;
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
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** T-44 게임 중 입장은 큐로, T-46(1) 결과 화면 퇴장 뒤 다음 라운드·빈 방 정리. */
class BattleMidGameJoinTest {

    private final BattleRoomManager roomManager = new BattleRoomManager();
    private final BattleRoomRepository repository = mock(BattleRoomRepository.class);
    private final GameStatusService gameStatusService = mock(GameStatusService.class);
    private final ThreadPoolTaskScheduler taskScheduler = mock(ThreadPoolTaskScheduler.class);
    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    private final ScheduledFuture<?> scheduledFuture = mock(ScheduledFuture.class);
    private final BattleRoomService service = new BattleRoomService(
            roomManager, repository, mock(BattleRankingService.class), gameStatusService, taskScheduler);

    private final BattleRoom room = BattleRoom.builder().roomId("r1").status("WAITING").maxPlayers(5).build();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);
        when(repository.findByRoomId("r1")).thenReturn(Optional.of(room));
        when(scheduledFuture.getDelay(TimeUnit.MILLISECONDS)).thenReturn(10_000L);
        doReturn(scheduledFuture).when(taskScheduler).schedule(any(Runnable.class), any(Instant.class));
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

    // ─── D-38: 결과 화면에 혼자 남으면 대기실로 ─────────────────────────────

    /** 2인 판을 끝내 결과 화면(FINISHED, 큐 없음)으로 만든다. 2번이 탈락, 1번이 우승. */
    private void twoPlayerResultScreen() {
        join("1");
        join("2");
        service.startGame("r1");
        service.handlePlayerFinished("r1", "2", 0);
        assertThat(room.getStatus()).isEqualTo("FINISHED");
    }

    private RoomStatePayload lastRoomState() {
        ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/blockfall-battle/room/r1"), sent.capture());
        return sent.getAllValues().stream()
                .map(BattleEnvelope.class::cast)
                .filter(e -> "ROOM_STATE".equals(e.getType()))
                .map(e -> (RoomStatePayload) e.getPayload())
                .reduce((a, b) -> b)
                .orElseThrow();
    }

    @Test
    @DisplayName("D-38: 2인 결과 화면에서 1명이 나가면 WAITING 이 되고, 자동 매칭이 새 상대를 그 방에 넣는다")
    void soloOnResultScreenReturnsToWaiting() {
        twoPlayerResultScreen();

        service.handleExplicitLeave("s-2");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(lastRoomState().getStatus()).isEqualTo("WAITING");
        assertThat(lastRoomState().getPlayers()).hasSize(1);

        when(repository.findFirstByStatus(eq("WAITING"), any(Sort.class))).thenReturn(Optional.of(room));
        BattleJoinResponse response = service.joinBattle(4L, null, false, "new");

        assertThat(response.getRoomId()).isEqualTo("r1");
        assertThat(response.getQueuePosition()).isNull();
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
        // 2명이 되었으니 카운트다운이 예약된다
        verify(taskScheduler, times(1)).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    @DisplayName("D-38: 게임이 꺼져 있으면 혼자 남아도 대기실로 다시 열지 않는다 (T-33)")
    void soloOnResultScreenDisabledStaysFinished() {
        twoPlayerResultScreen();
        when(gameStatusService.isDisabled("blockfall-battle")).thenReturn(true);

        service.handleExplicitLeave("s-2");

        assertThat(room.getStatus()).isEqualTo("FINISHED");
    }

    @Test
    @DisplayName("D-38: 2인 결과 화면에서 1명의 끊김 유예가 끝나도 WAITING 이 된다")
    void soloAfterDisconnectGraceReturnsToWaiting() {
        twoPlayerResultScreen();

        service.handleLeaveBySession("s-2");
        ArgumentCaptor<Runnable> grace = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler).schedule(grace.capture(), any(Instant.class));
        grace.getValue().run();

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(lastRoomState().getStatus()).isEqualTo("WAITING");
    }

    @Test
    @DisplayName("D-38: 남아 있던 자동 승격 타이머는 취소되고, 늦게 실행돼도 아무것도 하지 않는다")
    void staleNextRoundTimerIgnored() {
        twoPlayerResultScreen();
        // 결과 화면에 큐 사용자가 들어와 자동 승격이 예약된 뒤 그 사람이 나간다 — 예약은 남는다
        when(repository.findFirstByStatus(eq("PLAYING"), any(Sort.class))).thenReturn(Optional.of(room));
        assertThat(service.joinBattle(3L, null, false, "q").getQueuePosition()).isEqualTo(1);
        roomManager.registerSession("r1", "3", "s-3");
        service.handleExplicitLeave("s-3");
        ArgumentCaptor<Runnable> timer = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, times(1)).schedule(timer.capture(), any(Instant.class));

        service.handleExplicitLeave("s-2");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        verify(scheduledFuture).cancel(false);

        clearInvocations(messagingTemplate);
        timer.getValue().run();

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(roomManager.getActivePlayers("r1")).hasSize(1);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("D-38: 혼자 남을 때 큐 사용자가 있으면 10초를 기다리지 않고 그 시점에 승격한다")
    void soloWithQueuePromotesImmediately() {
        playingRoomWithLateJoiner();
        service.handlePlayerFinished("r1", "2", 0);   // 1번 우승, 큐에 3번 → 10초 자동 승격 예약
        ArgumentCaptor<Runnable> timer = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, times(1)).schedule(timer.capture(), any(Instant.class));

        service.handleExplicitLeave("s-1");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(roomManager.findActivePlayer("r1", "3")).isPresent();
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
        assertThat(roomManager.getQueueSize("r1")).isZero();
        verify(scheduledFuture).cancel(false);

        // 남아 있던 10초 타이머가 늦게 실행돼도 아무 일도 하지 않는다
        clearInvocations(messagingTemplate);
        timer.getValue().run();
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
        verifyNoInteractions(messagingTemplate);
    }

    /** 게임 중 상대 이탈로 끝난 결과 화면(FINISHED, 1명)에서 준비 → WAITING, 자동 매칭으로 새 상대가 들어온다. */
    private void readyAloneThenRematch() {
        assertThat(room.getStatus()).isEqualTo("FINISHED");
        assertThat(roomManager.getActivePlayers("r1")).hasSize(1);

        service.handlePlayerReady("r1", "1");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(lastRoomState().getStatus()).isEqualTo("WAITING");

        when(repository.findFirstByStatus(eq("WAITING"), any(Sort.class))).thenReturn(Optional.of(room));
        BattleJoinResponse response = service.joinBattle(4L, null, false, "new");

        assertThat(response.getRoomId()).isEqualTo("r1");
        assertThat(response.getQueuePosition()).isNull();
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
    }

    @Test
    @DisplayName("D-38: 게임 중 상대가 LEAVE 해 혼자 남은 결과 화면은 그대로 보이고, 준비하면 WAITING 으로 가 새 상대를 받는다")
    void midGameLeaveAloneReadyReturnsToWaiting() {
        join("1");
        join("2");
        service.startGame("r1");

        service.handleExplicitLeave("s-2");

        readyAloneThenRematch();
        verify(messagingTemplate, never())
                .convertAndSendToUser(anyString(), eq("/queue/blockfall-battle/errors"), any(Object.class));
    }

    @Test
    @DisplayName("D-38: 게임 중 상대의 끊김 유예가 끝나 혼자 남은 결과 화면도 준비하면 WAITING 으로 간다")
    void midGameDisconnectAloneReadyReturnsToWaiting() {
        join("1");
        join("2");
        service.startGame("r1");

        service.handleLeaveBySession("s-2");
        ArgumentCaptor<Runnable> grace = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler).schedule(grace.capture(), any(Instant.class));
        grace.getValue().run();

        readyAloneThenRematch();
    }

    @Test
    @DisplayName("D-38: 게임이 꺼져 있으면 혼자 준비해도 결과 화면에 남는다")
    void midGameLeaveAloneReadyDisabledStaysFinished() {
        join("1");
        join("2");
        service.startGame("r1");
        service.handleExplicitLeave("s-2");
        when(gameStatusService.isDisabled("blockfall-battle")).thenReturn(true);

        service.handlePlayerReady("r1", "1");

        assertThat(room.getStatus()).isEqualTo("FINISHED");
    }

    // ─── T48-RISK1: 끊김 유예 중인 참가자는 시작 판정에서 빠진다 ─────────────

    private List<Runnable> scheduledTasks(int expected) {
        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, times(expected)).schedule(task.capture(), any(Instant.class));
        return task.getAllValues();
    }

    private List<BattleEnvelope> roomBroadcasts() {
        ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/blockfall-battle/room/r1"), sent.capture());
        return sent.getAllValues().stream().map(BattleEnvelope.class::cast).toList();
    }

    private List<String> gameStartedPlayerIds() {
        GameStartedPayload started = roomBroadcasts().stream()
                .filter(e -> "GAME_STARTED".equals(e.getType()))
                .map(e -> (GameStartedPayload) e.getPayload())
                .reduce((a, b) -> b)
                .orElseThrow();
        return started.getPlayers().stream().map(PlayerInfo::getId).toList();
    }

    @Test
    @DisplayName("T48-RISK1 ghostPlay: 결과 화면에 끊긴 사람만 남으면 WAITING 으로 열지 않고, 새 사용자는 그 방에 매칭되지 않으며, 유예가 끝나면 닫힌다")
    void ghostOnlyResultScreenNotReopened() {
        twoPlayerResultScreen();

        service.handleLeaveBySession("s-2");
        service.handleExplicitLeave("s-1");

        assertThat(room.getStatus()).isEqualTo("FINISHED");

        BattleJoinResponse response = service.joinBattle(4L, null, false, "new");
        assertThat(response.getRoomId()).isNotEqualTo("r1");
        assertThat(roomManager.findActivePlayer("r1", "4")).isEmpty();

        List<Runnable> tasks = scheduledTasks(1);   // 유예 타이머만 — 카운트다운 없음
        tasks.get(0).run();

        assertThat(room.getClosedAt()).isNotNull();
        assertThat(roomManager.getActivePlayers("r1")).isEmpty();
    }

    @Test
    @DisplayName("T48-RISK1 ghostReady: 준비 뒤 끊긴 사람은 빼고 판정한다 — 남은 사람의 판은 유령 없이 새 상대와 시작된다")
    void readyThenDisconnectedExcluded() {
        twoPlayerResultScreen();
        service.handlePlayerReady("r1", "2");
        service.handleLeaveBySession("s-2");

        service.handlePlayerReady("r1", "1");

        // 연결된 사람은 1명 — 다음 라운드(게임)는 열리지 않고 D-38 대로 대기실이 된다. 카운트다운도 없다.
        assertThat(room.getStatus()).isEqualTo("WAITING");
        scheduledTasks(1);

        when(repository.findFirstByStatus(eq("WAITING"), any(Sort.class))).thenReturn(Optional.of(room));
        assertThat(service.joinBattle(4L, null, false, "new").getRoomId()).isEqualTo("r1");
        List<Runnable> tasks = scheduledTasks(2);   // [0] 유예, [1] 카운트다운
        tasks.get(1).run();

        assertThat(room.getStatus()).isEqualTo("PLAYING");
        assertThat(gameStartedPlayerIds()).containsExactly("1", "4");
        assertThat(roomManager.findActivePlayer("r1", "2")).isEmpty();
        assertThat(roomManager.getQueuePlayers("r1")).extracting(BattleRoomManager.PlayerSessionInfo::getPlayerId)
                .containsExactly("2");

        // 유예가 끝나면 큐에서 정리될 뿐 판에는 영향이 없다
        tasks.get(0).run();
        assertThat(roomManager.getQueueSize("r1")).isZero();
        assertThat(roomManager.getAlivePlayers("r1")).hasSize(2);
        assertThat(room.getStatus()).isEqualTo("PLAYING");
    }

    @Test
    @DisplayName("T48-RISK1: 결과 화면에서 준비하지 않은 사람이 끊기면, 남은 연결된 사람이 모두 준비했을 때 유예를 기다리지 않고 다음 라운드로 간다")
    void unreadyDisconnectStartsNextRound() {
        join("1");
        join("2");
        join("3");
        service.finishGame("r1");
        service.handlePlayerReady("r1", "1");
        service.handlePlayerReady("r1", "2");
        assertThat(room.getStatus()).isEqualTo("FINISHED");

        service.handleLeaveBySession("s-3");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        scheduledTasks(2);   // 다음 라운드 카운트다운 + 유예 타이머
    }

    @Test
    @DisplayName("T48-RISK1: 유예 중 재연결하면 그대로 복귀하고, 2인 준비로 다음 라운드가 열린다")
    void reconnectDuringGraceRestores() {
        twoPlayerResultScreen();
        service.handleLeaveBySession("s-2");
        service.registerSession("2", "s-2b");

        scheduledTasks(1).get(0).run();   // 유예 만료 — 이미 재연결했으므로 무시

        assertThat(roomManager.getConnectedPlayers("r1")).hasSize(2);
        service.handlePlayerReady("r1", "1");
        assertThat(room.getStatus()).isEqualTo("FINISHED");
        service.handlePlayerReady("r1", "2");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(roomManager.getActivePlayers("r1")).hasSize(2);
        scheduledTasks(2);   // 다음 라운드 카운트다운
    }

    @Test
    @DisplayName("T48-RISK1: 끊긴 사람만 남은 결과 화면에 그 사람이 돌아오면 결과 화면을 유지하고, 준비하면 WAITING 이 된다 (D-38)")
    void ghostReconnectsAloneReadyReturnsToWaiting() {
        twoPlayerResultScreen();
        service.handleLeaveBySession("s-2");
        service.handleExplicitLeave("s-1");

        service.registerSession("2", "s-2b");
        assertThat(room.getStatus()).isEqualTo("FINISHED");

        service.handlePlayerReady("r1", "2");

        assertThat(room.getStatus()).isEqualTo("WAITING");
        assertThat(roomManager.getActivePlayers("r1")).hasSize(1);
    }

    @Test
    @DisplayName("T48-RISK1: 대기실 카운트다운 중 끊기면 카운트다운을 멈추고, 재연결하면 다시 시작한다")
    void lobbyCountdownPausedWhileDisconnected() {
        join("1");
        join("2");
        service.tryStartCountdown("r1");

        service.handleLeaveBySession("s-1");

        verify(scheduledFuture).cancel(false);
        assertThat(roomBroadcasts()).extracting(BattleEnvelope::getType).contains("MATCH_COUNTDOWN_CANCELLED");

        service.registerSession("1", "s-1b");

        scheduledTasks(3);   // 카운트다운, 유예, 재연결 뒤 카운트다운
    }

    // ─── R7(T-41 확장): 상태 재요청은 참가자·큐 사용자만 ─────────────────────

    private List<String> stateTypesSentTo(String playerId) {
        ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSendToUser(eq(playerId), anyString(), sent.capture());
        return sent.getAllValues().stream().map(BattleEnvelope.class::cast).map(BattleEnvelope::getType).toList();
    }

    @Test
    @DisplayName("R7: 방 밖의 사용자가 상태를 요청하면 아무것도 보내지 않는다")
    void requestStateOutsiderIgnored() {
        join("1");
        join("2");

        service.handleRequestState("r1", "outsider");

        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any(Object.class));
    }

    @Test
    @DisplayName("R7: 활성 참가자는 상태 요청에 ROOM_STATE 를 받는다")
    void requestStateMemberGetsRoomState() {
        join("1");
        join("2");

        service.handleRequestState("r1", "1");

        assertThat(stateTypesSentTo("1")).contains("ROOM_STATE");
    }

    @Test
    @DisplayName("R7: 큐 사용자는 상태 요청에 ROOM_STATE 와 QUEUE_POSITION 을 받는다")
    void requestStateQueuedGetsRoomStateAndPosition() {
        playingRoomWithLateJoiner();
        clearInvocations(messagingTemplate);

        service.handleRequestState("r1", "3");

        assertThat(stateTypesSentTo("3")).containsExactly("ROOM_STATE", "QUEUE_POSITION");
    }
}
