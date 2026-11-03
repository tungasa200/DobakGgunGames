package com.dobakggun.service;

import com.dobakggun.domain.apple.AppleBattleRoom;
import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom;
import com.dobakggun.repository.AppleBattleRecordRepository;
import com.dobakggun.repository.AppleRoomRepository;
import com.dobakggun.repository.MinesweeperBattleRecordRepository;
import com.dobakggun.repository.MinesweeperRoomRepository;
import com.dobakggun.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.concurrent.ScheduledFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 상대가 오기 전에 끊긴 대기 방은 승부가 아니므로 아무도 들어오지 못하고 전적 없이 닫힌다. */
class BattleWaitingDisconnectTest {

    private final ThreadPoolTaskScheduler taskScheduler = mock(ThreadPoolTaskScheduler.class);
    private final UserRepository userRepository = mock(UserRepository.class);

    private final AppleBattleRoomManager appleManager = new AppleBattleRoomManager();
    private final AppleBattleRoomService appleService = new AppleBattleRoomService(
            appleManager, mock(AppleBattleRecordRepository.class), mock(AppleRoomRepository.class),
            userRepository, mock(GameStatusService.class), taskScheduler);

    private final MinesweeperBattleRoomManager minesweeperManager = new MinesweeperBattleRoomManager();
    private final MinesweeperBattleRoomService minesweeperService = new MinesweeperBattleRoomService(
            minesweeperManager, mock(MinesweeperRoomRepository.class), mock(MinesweeperBattleRecordRepository.class),
            userRepository, mock(GameStatusService.class), taskScheduler);

    private String minesweeperDifficulty;

    @BeforeEach
    void setUp() {
        doReturn(mock(ScheduledFuture.class)).when(taskScheduler).schedule(any(Runnable.class), any(Instant.class));

        ReflectionTestUtils.setField(appleService, "messagingTemplate", mock(SimpMessagingTemplate.class));
        appleManager.createRoom("r1");
        appleManager.addPlayer("r1", new AppleBattleRoom.PlayerInfo("1", "a", false, 1L));
        appleManager.registerSession("r1", "1", "s1");

        ReflectionTestUtils.setField(minesweeperService, "messagingTemplate", mock(SimpMessagingTemplate.class));
        minesweeperDifficulty = minesweeperManager.createRoom("r1").getDifficulty();
        minesweeperManager.addPlayer("r1", new MinesweeperBattleRoom.PlayerInfo("1", "a", false, 1L));
        minesweeperManager.registerSession("r1", "1", "s1");
    }

    private Runnable capturedGraceTask() {
        ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler).schedule(task.capture(), any(Instant.class));
        return task.getValue();
    }

    @Test
    @DisplayName("사과 배틀: 유예가 끝나면 전적 없이 방을 닫는다")
    void appleClosedWithoutRecord() {
        appleService.handleDisconnect("s1");
        capturedGraceTask().run();

        assertThat(appleManager.getRoom("r1")).isEmpty();
        verify(userRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("사과 배틀: 끊긴 방장의 대기 방에는 들어갈 수 없다")
    void appleRejectsJoinWhileHostDisconnected() {
        assertThat(appleManager.findWaitingRoom()).isPresent();

        appleService.handleDisconnect("s1");

        assertThat(appleManager.findWaitingRoom()).isEmpty();
        assertThatThrownBy(() -> appleService.joinSpecificRoom("r1", 2L, null, "b"))
                .isInstanceOf(AppleBattleRoomService.RoomFullOrStartedException.class);
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 끊긴 방장의 대기 방에는 들어갈 수 없다")
    void minesweeperRejectsJoinWhileHostDisconnected() {
        assertThat(minesweeperManager.findWaitingRoom(minesweeperDifficulty)).isPresent();

        minesweeperService.handleDisconnect("s1");

        assertThat(minesweeperManager.findWaitingRoom(minesweeperDifficulty)).isEmpty();
        assertThatThrownBy(() -> minesweeperService.joinSpecificRoom("r1", 2L, null, "b"))
                .isInstanceOf(MinesweeperBattleRoomService.RoomFullOrStartedException.class);
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 유예가 끝나면 전적 없이 방을 닫는다")
    void minesweeperClosedWithoutRecord() {
        minesweeperService.handleDisconnect("s1");
        capturedGraceTask().run();

        assertThat(minesweeperManager.getRoom("r1")).isEmpty();
        verify(userRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("사과 배틀: 방장이 끊긴 동안 대기 방 목록에서 빠지고, 다시 연결하면 돌아온다")
    void appleWaitingListHidesDisconnectedHost() {
        assertThat(appleManager.getWaitingRooms()).hasSize(1);

        appleService.handleDisconnect("s1");
        assertThat(appleManager.getWaitingRooms()).isEmpty();

        appleService.handleConnect("1", "s1b");
        assertThat(appleManager.getWaitingRooms()).extracting(AppleBattleRoom::getRoomId).containsExactly("r1");
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 방장이 끊긴 동안 대기 방 목록에서 빠지고, 다시 연결하면 돌아온다")
    void minesweeperWaitingListHidesDisconnectedHost() {
        assertThat(minesweeperManager.getWaitingRooms()).hasSize(1);

        minesweeperService.handleDisconnect("s1");
        assertThat(minesweeperManager.getWaitingRooms()).isEmpty();

        minesweeperService.handleConnect("1", "s1b");
        assertThat(minesweeperManager.getWaitingRooms()).extracting(MinesweeperBattleRoom::getRoomId).containsExactly("r1");
    }

    /** 2명이 매칭된 지뢰찾기 방에서 1번이 끊기고 유예가 끝난다. */
    private MinesweeperBattleRoom minesweeperMatchedAndHostGraceExpired(boolean started) {
        MinesweeperBattleRoom room = minesweeperManager.getRoom("r1").orElseThrow();
        minesweeperManager.addPlayer("r1", new MinesweeperBattleRoom.PlayerInfo("2", "b", false, 2L));
        minesweeperManager.registerSession("r1", "2", "s2");
        if (started) {
            room.setStatus(MinesweeperBattleRoom.Status.PLAYING);
            room.setServerStartAtMillis(System.currentTimeMillis());
        } else {
            room.setStatus(MinesweeperBattleRoom.Status.MATCH_READY);
            room.getFirstClickSet().add("2"); // 한쪽만 클릭한 상태도 시작 전이다
        }

        minesweeperService.handleDisconnect("s1");
        capturedGraceTask().run();
        return room;
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 양쪽 첫 클릭 전에 끊겨 유예가 끝나면 판은 끝나지만 전적은 0건이다 (D-36)")
    void minesweeperDisconnectBeforeStartRecordsNothing() {
        MinesweeperBattleRoom room = minesweeperMatchedAndHostGraceExpired(false);

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        verify(userRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 혼자 클릭한 쪽이 끊긴 채 첫 클릭 타임아웃이 먼저 끝나도 전적은 0건이다 (D-36)")
    void minesweeperFirstClickTimeoutWhileDisconnectedRecordsNothing() {
        MinesweeperBattleRoom room = minesweeperManager.getRoom("r1").orElseThrow();
        minesweeperManager.addPlayer("r1", new MinesweeperBattleRoom.PlayerInfo("2", "b", false, 2L));
        minesweeperManager.registerSession("r1", "2", "s2");
        room.setStatus(MinesweeperBattleRoom.Status.MATCH_READY);
        room.getFirstClickSet().add("2");
        minesweeperService.handleDisconnect("s2");
        room.findPlayer("1").setEndReason("FIRST_CLICK_TIMEOUT");

        minesweeperService.recordWinLoss(room, "2", "FIRST_CLICK_TIMEOUT");

        verify(userRepository, never()).findById(anyLong());
    }

    /** 2명이 매칭된 지뢰찾기 방에서 1번이 LEAVE를 보낸다. */
    private MinesweeperBattleRoom minesweeperMatchedAndHostLeaves(boolean started) {
        MinesweeperBattleRoom room = minesweeperManager.getRoom("r1").orElseThrow();
        minesweeperManager.addPlayer("r1", new MinesweeperBattleRoom.PlayerInfo("2", "b", false, 2L));
        minesweeperManager.registerSession("r1", "2", "s2");
        if (started) {
            room.setStatus(MinesweeperBattleRoom.Status.PLAYING);
            room.setServerStartAtMillis(System.currentTimeMillis());
        } else {
            room.setStatus(MinesweeperBattleRoom.Status.MATCH_READY);
            room.getFirstClickSet().add("2");
        }

        minesweeperService.handleLeave("r1", "1");
        return room;
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 양쪽 첫 클릭 전에 LEAVE하면 판은 끝나지만 전적은 0건이다 (D-36, 카드 0130)")
    void minesweeperLeaveBeforeStartRecordsNothing() {
        MinesweeperBattleRoom room = minesweeperMatchedAndHostLeaves(false);

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        verify(userRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 게임 시작 뒤 LEAVE하면 남은 쪽만 승리로 기록하고 나간 쪽은 미가산이다")
    void minesweeperLeaveAfterStartGivesOpponentWin() {
        MinesweeperBattleRoom room = minesweeperMatchedAndHostLeaves(true);

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        verify(userRepository).findById(2L);
        verify(userRepository, never()).findById(1L);
    }

    @Test
    @DisplayName("지뢰찾기 배틀: 게임 시작 뒤 끊겨 유예가 끝나면 상대 승리로 전적을 남긴다")
    void minesweeperDisconnectAfterStartGivesOpponentWin() {
        MinesweeperBattleRoom room = minesweeperMatchedAndHostGraceExpired(true);

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        assertThat(room.findPlayer("2").getEndReason()).isEqualTo("OPPONENT_FORFEIT");
        assertThat(room.findPlayer("1").getEndReason()).isEqualTo("DISCONNECT");
        verify(userRepository).findById(1L);
        verify(userRepository).findById(2L);
    }
}
