package com.dobakggun.service;

import com.dobakggun.entity.rps.RoomStatus;
import com.dobakggun.entity.rps.RpsRoom;
import com.dobakggun.repository.RpsPlayerStatRepository;
import com.dobakggun.repository.RpsRoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** HTTP 매칭의 자리 예약과 WS 입장의 방 존재 확인. */
class RpsRoomReservationTest {

    private final RpsRoomRepository repository = mock(RpsRoomRepository.class);
    private final ThreadPoolTaskScheduler scheduler = mock(ThreadPoolTaskScheduler.class);
    private final RpsRoomService service = new RpsRoomService(
            repository, mock(RpsPlayerStatRepository.class), scheduler,
            mock(RpsGameService.class), mock(GameStatusService.class));

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "messagingTemplate", mock(SimpMessagingTemplate.class));
    }

    private void dbRoom(RoomStatus status) {
        when(repository.findByRoomId("r1")).thenReturn(Optional.of(
                RpsRoom.builder().roomId("r1").name("n").status(status).maxPlayers(4).currentPlayers(1).build()));
    }

    private Runnable reserve(Long userId) {
        clearInvocations(scheduler); // 앞선 입장이 건 카운트다운 제외
        service.reserve("r1", userId);
        ArgumentCaptor<Runnable> expiry = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(expiry.capture(), any(Instant.class));
        return expiry.getValue();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> rooms() {
        return (ConcurrentHashMap<String, Object>) ReflectionTestUtils.getField(service, "rooms");
    }

    @Test
    void DB에_없는_방으로는_입장할_수_없고_메모리_방도_생기지_않는다() {
        assertThat(service.joinRoom("ghost", 1L, "a")).isEqualTo("ROOM_NOT_FOUND");

        assertThat(rooms()).isEmpty();
    }

    @Test
    void 끝난_방으로는_입장할_수_없다() {
        dbRoom(RoomStatus.FINISHED);

        assertThat(service.joinRoom("r1", 1L, "a")).isEqualTo("ROOM_NOT_FOUND");

        assertThat(rooms()).isEmpty();
    }

    @Test
    void 대기_중인_DB_방에는_입장한다() {
        dbRoom(RoomStatus.WAITING);

        assertThat(service.joinRoom("r1", 1L, "a")).isNull();

        assertThat(service.isParticipant("r1", 1L)).isTrue();
        verify(repository).updateCurrentPlayers("r1", 1);
    }

    @Test
    void 입장하지_않은_예약이_만료되면_인원이_복구된다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        Runnable expiry = reserve(2L);

        expiry.run();

        assertThat(service.findActiveRoomId(2L)).isEmpty();
        verify(repository, org.mockito.Mockito.times(2)).updateCurrentPlayers("r1", 1);
    }

    @Test
    void 아무도_입장하지_않은_방은_예약이_만료되면_닫힌다() {
        RpsRoom room = RpsRoom.builder().roomId("r1").name("n").status(RoomStatus.WAITING)
                .maxPlayers(4).currentPlayers(1).build();
        when(repository.findByRoomId("r1")).thenReturn(Optional.of(room));
        Runnable expiry = reserve(1L);

        expiry.run();

        assertThat(room.getStatus()).isEqualTo(RoomStatus.FINISHED);
        verify(repository, never()).updateCurrentPlayers(anyString(), anyInt());
    }

    @Test
    void 입장한_예약은_만료되어도_인원을_바꾸지_않는다() {
        dbRoom(RoomStatus.WAITING);
        Runnable expiry = reserve(1L);
        service.joinRoom("r1", 1L, "a");

        expiry.run();

        assertThat(service.isParticipant("r1", 1L)).isTrue();
        verify(repository).updateCurrentPlayers("r1", 1);
    }

    @Test
    void 예약이_남은_사용자는_활성_방이_있는_것으로_본다() {
        reserve(2L);

        assertThat(service.findActiveRoomId(2L)).contains("r1");
    }

    @Test
    void 나가면_남은_인원과_예약으로_DB_인원을_맞춘다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        service.joinRoom("r1", 2L, "b");
        reserve(3L);
        clearInvocations(repository);

        service.leaveRoom("r1", 2L, "LEAVE");

        verify(repository).updateCurrentPlayers("r1", 2);
    }

    @Test
    void 마지막_참가자가_나가도_예약자는_같은_방에_입장한다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        reserve(2L);

        service.leaveRoom("r1", 1L, "LEAVE");

        verify(repository, never()).save(any());
        assertThat(service.joinRoom("r1", 2L, "b")).isNull();
    }

    @Test
    void 정원이_찬_방에는_예약_없이_들어올_수_없다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        service.joinRoom("r1", 2L, "b");
        service.joinRoom("r1", 3L, "c");
        reserve(4L);

        assertThat(service.joinRoom("r1", 5L, "e")).isEqualTo("ROOM_NOT_AVAILABLE");
        assertThat(service.joinRoom("r1", 4L, "d")).isNull();
    }

    @Test
    void 입장이_거부되면_예약을_풀어_재매칭할_수_있다() {
        when(repository.findByRoomId("r1")).thenReturn(Optional.empty());
        reserve(2L);

        assertThat(service.joinRoom("r1", 2L, "b")).isEqualTo("ROOM_NOT_FOUND");

        assertThat(service.findActiveRoomId(2L)).isEmpty();
    }

    private void setStatus(RoomStatus status) {
        ((RpsRoomService.RpsRoomState) rooms().get("r1")).status = status;
    }

    @Test
    void 게임_중인_참가자는_다시_입장해도_거부되지_않고_밖의_사용자는_거부된다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        service.joinRoom("r1", 2L, "b");
        setStatus(RoomStatus.PLAYING);

        assertThat(service.joinRoom("r1", 1L, "a")).isNull();
        assertThat(service.joinRoom("r1", 3L, "c")).isEqualTo("ROOM_NOT_AVAILABLE");
    }

    @Test
    void 닫힌_방에는_참가자였어도_다시_입장할_수_없다() {
        dbRoom(RoomStatus.WAITING);
        service.joinRoom("r1", 1L, "a");
        setStatus(RoomStatus.FINISHED);

        assertThat(service.joinRoom("r1", 1L, "a")).isEqualTo("ROOM_NOT_AVAILABLE");
    }

    @Test
    void 입장_전에_나가면_예약을_푼다() {
        dbRoom(RoomStatus.WAITING);
        reserve(2L);

        service.leaveRoom("r1", 2L, "LEAVE");

        assertThat(service.findActiveRoomId(2L)).isEmpty();
    }
}
