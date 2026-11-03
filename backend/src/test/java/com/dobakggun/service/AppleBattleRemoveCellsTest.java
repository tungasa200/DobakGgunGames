package com.dobakggun.service;

import com.dobakggun.domain.apple.AppleBattleRoom;
import com.dobakggun.repository.AppleBattleRecordRepository;
import com.dobakggun.repository.AppleRoomRepository;
import com.dobakggun.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 좌표에 null이 섞인 REMOVE는 예외 없이 형식 오류로 거절한다. */
class AppleBattleRemoveCellsTest {

    @Test
    void 좌표에_null이_있으면_INVALID_CELLS_오류를_보내고_보드를_바꾸지_않는다() {
        AppleBattleRoomManager manager = mock(AppleBattleRoomManager.class);
        AppleBattleRoomService service = new AppleBattleRoomService(
                manager, mock(AppleBattleRecordRepository.class), mock(AppleRoomRepository.class),
                mock(UserRepository.class), mock(GameStatusService.class), mock(ThreadPoolTaskScheduler.class));
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);

        AppleBattleRoom room = new AppleBattleRoom("r1");
        room.setStatus(AppleBattleRoom.Status.PLAYING);
        room.getPlayers().add(new AppleBattleRoom.PlayerInfo("1", "a", false, 1L));
        room.setBoard(new Integer[][]{{5, 5}});
        when(manager.getRoom("r1")).thenReturn(Optional.of(room));

        List<List<Integer>> cells = List.of(Arrays.asList(null, 0), Arrays.asList(0, null));
        service.handleRemove("r1", "1", cells);

        verify(messagingTemplate).convertAndSendToUser(
                eq("1"), eq(AppleBattleRoomService.USER_QUEUE_ERRORS), any(Object.class));
        assertThat(room.getBoard()[0]).containsExactly(5, 5);
        assertThat(room.getLock().isLocked()).isFalse();
    }

    @Test
    void 같은_셀을_두_번_넣으면_INVALID_CELLS_오류를_보내고_점수를_주지_않는다() {
        AppleBattleRoomManager manager = mock(AppleBattleRoomManager.class);
        AppleBattleRoomService service = new AppleBattleRoomService(
                manager, mock(AppleBattleRecordRepository.class), mock(AppleRoomRepository.class),
                mock(UserRepository.class), mock(GameStatusService.class), mock(ThreadPoolTaskScheduler.class));
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);

        AppleBattleRoom room = new AppleBattleRoom("r1");
        room.setStatus(AppleBattleRoom.Status.PLAYING);
        room.getPlayers().add(new AppleBattleRoom.PlayerInfo("1", "a", false, 1L));
        room.setBoard(new Integer[][]{{5, 5}});
        when(manager.getRoom("r1")).thenReturn(Optional.of(room));

        service.handleRemove("r1", "1", List.of(List.of(0, 0), List.of(0, 0)));

        verify(messagingTemplate).convertAndSendToUser(
                eq("1"), eq(AppleBattleRoomService.USER_QUEUE_ERRORS), any(Object.class));
        assertThat(room.getBoard()[0]).containsExactly(5, 5);
        assertThat(room.getScores().get("1")).isNull();
    }
}
