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
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 방 ID를 안다고 남의 방을 닫거나 끝낼 수 없다. */
class BattleLeaveMembershipTest {

    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);

    private final AppleBattleRoomManager appleManager = mock(AppleBattleRoomManager.class);
    private final AppleBattleRoomService apple = new AppleBattleRoomService(
            appleManager, mock(AppleBattleRecordRepository.class), mock(AppleRoomRepository.class),
            mock(UserRepository.class), mock(GameStatusService.class), mock(ThreadPoolTaskScheduler.class));

    private final MinesweeperBattleRoomManager minesweeperManager = mock(MinesweeperBattleRoomManager.class);
    private final MinesweeperBattleRoomService minesweeper = new MinesweeperBattleRoomService(
            minesweeperManager, mock(MinesweeperRoomRepository.class), mock(MinesweeperBattleRecordRepository.class),
            mock(UserRepository.class), mock(GameStatusService.class), mock(ThreadPoolTaskScheduler.class));

    private final ReentrantLock roomLock = new ReentrantLock();

    @BeforeEach
    void injectMessaging() {
        ReflectionTestUtils.setField(apple, "messagingTemplate", messagingTemplate);
        ReflectionTestUtils.setField(minesweeper, "messagingTemplate", messagingTemplate);
        when(appleManager.getRoomLock("r1")).thenReturn(roomLock);
        when(minesweeperManager.getRoomLock("r1")).thenReturn(roomLock);
    }

    private AppleBattleRoom appleRoom(AppleBattleRoom.Status status) {
        AppleBattleRoom room = new AppleBattleRoom("r1");
        room.setStatus(status);
        room.getPlayers().add(new AppleBattleRoom.PlayerInfo("1", "a", false, 1L));
        when(appleManager.getRoom("r1")).thenReturn(Optional.of(room));
        return room;
    }

    private MinesweeperBattleRoom minesweeperRoom(MinesweeperBattleRoom.Status status) {
        MinesweeperBattleRoom room = new MinesweeperBattleRoom("r1");
        room.setStatus(status);
        room.getPlayers().add(new MinesweeperBattleRoom.PlayerInfo("1", "a", false, 1L));
        when(minesweeperManager.getRoom("r1")).thenReturn(Optional.of(room));
        return room;
    }

    private void verifyIgnored() {
        verify(messagingTemplate, never()).convertAndSendToUser(eq("outsider"), anyString(), any(Object.class));
    }

    @Test
    @DisplayName("사과: 방 밖의 사용자는 대기 방을 닫지 못하고, 방장은 닫을 수 있다")
    void appleWaitingRoom() {
        AppleBattleRoom room = appleRoom(AppleBattleRoom.Status.WAITING);

        apple.handleLeave("r1", "outsider");

        assertThat(room.getStatus()).isEqualTo(AppleBattleRoom.Status.WAITING);
        verify(appleManager, never()).closeRoom(anyString());
        verifyIgnored();

        apple.handleLeave("r1", "1");

        assertThat(room.getStatus()).isEqualTo(AppleBattleRoom.Status.FINISHED);
        verify(appleManager).closeRoom("r1");
    }

    @Test
    @DisplayName("사과: 방 밖의 사용자는 진행 중인 게임을 끝내지 못한다")
    void applePlayingRoom() {
        AppleBattleRoom room = appleRoom(AppleBattleRoom.Status.PLAYING);

        apple.handleLeave("r1", "outsider");

        assertThat(room.getFinished().get()).isFalse();
        verifyIgnored();
    }

    @Test
    @DisplayName("지뢰찾기: 방 밖의 사용자는 대기 방을 닫지 못하고, 방장은 닫을 수 있다")
    void minesweeperWaitingRoom() {
        MinesweeperBattleRoom room = minesweeperRoom(MinesweeperBattleRoom.Status.WAITING);

        minesweeper.handleLeave("r1", "outsider");

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.WAITING);
        verify(minesweeperManager, never()).closeRoom(anyString());
        verifyIgnored();

        minesweeper.handleLeave("r1", "1");

        assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        verify(minesweeperManager).closeRoom("r1");
    }

    @Test
    @DisplayName("지뢰찾기: 방 밖의 사용자는 진행 중인 게임을 끝내지 못한다")
    void minesweeperPlayingRoom() {
        MinesweeperBattleRoom room = minesweeperRoom(MinesweeperBattleRoom.Status.PLAYING);

        minesweeper.handleLeave("r1", "outsider");

        assertThat(room.getFinished().get()).isFalse();
        verifyIgnored();
    }

    @Test
    @DisplayName("사과: 대기 방 LEAVE는 입장과 같은 방 잠금 안에서 방을 닫는다")
    void appleLeaveHoldsRoomLock() {
        appleRoom(AppleBattleRoom.Status.WAITING);
        doAnswer(inv -> {
            assertThat(roomLock.isHeldByCurrentThread()).isTrue();
            return null;
        }).when(appleManager).closeRoom("r1");

        apple.handleLeave("r1", "1");

        verify(appleManager).closeRoom("r1");
        assertThat(roomLock.isLocked()).isFalse();
    }

    @Test
    @DisplayName("지뢰찾기: 대기 방 LEAVE는 입장과 같은 방 잠금 안에서 방을 닫는다")
    void minesweeperLeaveHoldsRoomLock() {
        minesweeperRoom(MinesweeperBattleRoom.Status.WAITING);
        doAnswer(inv -> {
            assertThat(roomLock.isHeldByCurrentThread()).isTrue();
            return null;
        }).when(minesweeperManager).closeRoom("r1");

        minesweeper.handleLeave("r1", "1");

        verify(minesweeperManager).closeRoom("r1");
        assertThat(roomLock.isLocked()).isFalse();
    }

    @Test
    @DisplayName("사과·지뢰찾기: REST 대기 취소도 입장과 같은 방 잠금 안에서 방을 닫는다")
    void cancelWaitingHoldsRoomLock() {
        appleRoom(AppleBattleRoom.Status.WAITING);
        minesweeperRoom(MinesweeperBattleRoom.Status.WAITING);
        doAnswer(inv -> {
            assertThat(roomLock.isHeldByCurrentThread()).isTrue();
            return null;
        }).when(appleManager).closeRoom("r1");
        doAnswer(inv -> {
            assertThat(roomLock.isHeldByCurrentThread()).isTrue();
            return null;
        }).when(minesweeperManager).closeRoom("r1");

        assertThat(apple.cancelWaiting("r1", "1")).isTrue();
        assertThat(minesweeper.cancelWaiting("r1", "1")).isTrue();

        verify(appleManager).closeRoom("r1");
        verify(minesweeperManager).closeRoom("r1");
        assertThat(roomLock.isLocked()).isFalse();
    }

    @Test
    @DisplayName("사과: 방 밖의 사용자는 REQUEST_STATE로 방 상태를 받지 못하고, 참가자는 받는다")
    void appleRequestStateMembersOnly() {
        appleRoom(AppleBattleRoom.Status.MATCHED);

        apple.handleRequestState("r1", "outsider");
        verifyIgnored();

        apple.handleRequestState("r1", "1");
        verify(messagingTemplate).convertAndSendToUser(eq("1"), eq(AppleBattleRoomService.USER_QUEUE_STATE), any(Object.class));
    }

    @Test
    @DisplayName("지뢰찾기: 방 밖의 사용자는 REQUEST_STATE로 방 상태를 받지 못하고, 참가자는 받는다")
    void minesweeperRequestStateMembersOnly() {
        minesweeperRoom(MinesweeperBattleRoom.Status.PLAYING);

        minesweeper.handleRequestState("r1", "outsider");
        verifyIgnored();

        minesweeper.handleRequestState("r1", "1");
        verify(messagingTemplate).convertAndSendToUser(eq("1"), anyString(), any(Object.class));
    }
}
