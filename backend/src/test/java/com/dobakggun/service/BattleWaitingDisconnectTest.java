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
}
