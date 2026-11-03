package com.dobakggun.service;

import com.dobakggun.domain.apple.AppleBattleRoom;
import com.dobakggun.domain.minesweeper.MinesweeperBattleRoom;
import com.dobakggun.dto.rps.RpsEnvelopeDto;
import com.dobakggun.entity.battle.BattleRoom;
import com.dobakggun.entity.User;
import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtRoomStatus;
import com.dobakggun.exception.GameDisabledException;
import com.dobakggun.repository.AppleBattleRecordRepository;
import com.dobakggun.repository.AppleRoomRepository;
import com.dobakggun.repository.BattleRoomRepository;
import com.dobakggun.repository.MinesweeperBattleRecordRepository;
import com.dobakggun.repository.MinesweeperRoomRepository;
import com.dobakggun.repository.RpsPlayerStatRepository;
import com.dobakggun.repository.RpsRoomRepository;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.repository.YachtParticipantRepository;
import com.dobakggun.repository.YachtRoomRepository;
import com.dobakggun.repository.YachtScoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 킬스위치 서비스 차단: 재접속은 살리고, 새 시작과 재대결만 막는다. */
class GameDisabledGuardTest {

    private final GameStatusService gameStatusService = mock(GameStatusService.class);
    private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    private final ThreadPoolTaskScheduler taskScheduler = mock(ThreadPoolTaskScheduler.class);

    private void disable(String gameKey) {
        when(gameStatusService.isDisabled(gameKey)).thenReturn(true);
        doThrow(new GameDisabledException(gameKey)).when(gameStatusService).requireEnabled(gameKey);
    }

    @Nested
    @DisplayName("사과 배틀")
    class Apple {
        private final AppleBattleRoomManager roomManager = mock(AppleBattleRoomManager.class);
        private final AppleBattleRoomService service = new AppleBattleRoomService(
                roomManager, mock(AppleBattleRecordRepository.class), mock(AppleRoomRepository.class),
                mock(UserRepository.class), gameStatusService, taskScheduler);

        @BeforeEach
        void setUp() {
            ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);
            disable("apple-battle");
        }

        @Test
        @DisplayName("방에 있는 사용자는 꺼져도 ALREADY_IN_ROOM 으로 재접속한다")
        void reconnectSurvives() {
            AppleBattleRoom room = new AppleBattleRoom("r1");
            room.setStatus(AppleBattleRoom.Status.PLAYING);
            when(roomManager.isPlayerInAnyRoom("1")).thenReturn(true);
            when(roomManager.findRoomIdByPlayer("1")).thenReturn(Optional.of("r1"));
            when(roomManager.getRoom("r1")).thenReturn(Optional.of(room));

            assertThatThrownBy(() -> service.joinOrCreate(1L, null, "n"))
                    .isInstanceOf(AppleBattleRoomService.AlreadyInRoomException.class);
        }

        @Test
        @DisplayName("새 사용자는 join·create·join/{roomId} 모두 차단된다")
        void newPlayerBlocked() {
            assertThatThrownBy(() -> service.joinOrCreate(1L, null, "n"))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.createRoomOnly(1L, null, "n"))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.joinSpecificRoom("r1", 1L, null, "n"))
                    .isInstanceOf(GameDisabledException.class);
        }

        @Test
        @DisplayName("재대결: 기다리던 상대까지 거절을 받고 방은 다시 시작되지 않는다")
        void rematchDeclinedForBothRequesters() {
            AppleBattleRoom room = new AppleBattleRoom("r1");
            room.setStatus(AppleBattleRoom.Status.FINISHED);
            room.getPlayers().add(new AppleBattleRoom.PlayerInfo("1", "a", false, 1L));
            room.getPlayers().add(new AppleBattleRoom.PlayerInfo("2", "b", false, 2L));
            room.getRematchRequested().put("2", Boolean.TRUE);
            when(roomManager.getRoom("r1")).thenReturn(Optional.of(room));

            service.handleRematch("r1", "1");

            verify(messagingTemplate).convertAndSendToUser(eq("1"), eq("/queue/apple-battle/state"), any(Object.class));
            verify(messagingTemplate).convertAndSendToUser(eq("2"), eq("/queue/apple-battle/state"), any(Object.class));
            assertThat(room.getRematchRequested()).isEmpty();
            assertThat(room.getStatus()).isEqualTo(AppleBattleRoom.Status.FINISHED);
        }
    }

    @Nested
    @DisplayName("지뢰찾기 배틀")
    class Minesweeper {
        private final MinesweeperBattleRoomManager roomManager = mock(MinesweeperBattleRoomManager.class);
        private final MinesweeperBattleRoomService service = new MinesweeperBattleRoomService(
                roomManager, mock(MinesweeperRoomRepository.class), mock(MinesweeperBattleRecordRepository.class),
                mock(UserRepository.class), gameStatusService, taskScheduler);

        @BeforeEach
        void setUp() {
            ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);
            disable("minesweeper-battle");
        }

        @Test
        @DisplayName("방에 있는 사용자는 꺼져도 ALREADY_IN_ROOM 으로 재접속한다")
        void reconnectSurvives() {
            MinesweeperBattleRoom room = new MinesweeperBattleRoom("r1");
            room.setStatus(MinesweeperBattleRoom.Status.PLAYING);
            when(roomManager.isPlayerInAnyRoom("1")).thenReturn(true);
            when(roomManager.findRoomIdByPlayer("1")).thenReturn(Optional.of("r1"));
            when(roomManager.getRoom("r1")).thenReturn(Optional.of(room));

            assertThatThrownBy(() -> service.joinOrCreate(1L, null, "n", null))
                    .isInstanceOf(MinesweeperBattleRoomService.AlreadyInRoomException.class);
        }

        @Test
        @DisplayName("새 사용자는 join·create·join/{roomId} 모두 차단된다")
        void newPlayerBlocked() {
            assertThatThrownBy(() -> service.joinOrCreate(1L, null, "n", null))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.createRoomOnly(1L, null, "n", null))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.joinSpecificRoom("r1", 1L, null, "n"))
                    .isInstanceOf(GameDisabledException.class);
        }

        @Test
        @DisplayName("재대결: 기다리던 상대까지 거절을 받고 방은 다시 시작되지 않는다")
        void rematchDeclinedForBothRequesters() {
            MinesweeperBattleRoom room = new MinesweeperBattleRoom("r1");
            room.setStatus(MinesweeperBattleRoom.Status.FINISHED);
            room.getPlayers().add(new MinesweeperBattleRoom.PlayerInfo("1", "a", false, 1L));
            room.getPlayers().add(new MinesweeperBattleRoom.PlayerInfo("2", "b", false, 2L));
            room.getRematchSet().add("2");
            when(roomManager.getRoom("r1")).thenReturn(Optional.of(room));

            service.handleRematch("r1", "1");

            verify(messagingTemplate).convertAndSendToUser(eq("1"), eq("/queue/minesweeper-battle/state"), any(Object.class));
            verify(messagingTemplate).convertAndSendToUser(eq("2"), eq("/queue/minesweeper-battle/state"), any(Object.class));
            assertThat(room.getRematchSet()).isEmpty();
            assertThat(room.getStatus()).isEqualTo(MinesweeperBattleRoom.Status.FINISHED);
        }
    }

    @Nested
    @DisplayName("블록폴 배틀")
    class Blockfall {
        private final BattleRoomManager roomManager = mock(BattleRoomManager.class);
        private final BattleRoomRepository repository = mock(BattleRoomRepository.class);
        private final BattleRoomService service = new BattleRoomService(
                roomManager, repository, mock(BattleRankingService.class), gameStatusService, taskScheduler);

        @BeforeEach
        void setUp() {
            disable("blockfall-battle");
        }

        @Test
        @DisplayName("방에 있는 사용자는 꺼져도 ALREADY_IN_ROOM 으로 재접속한다")
        void reconnectSurvives() {
            when(roomManager.findActiveRoomByPlayerId("1")).thenReturn(Optional.of("r1"));

            assertThatThrownBy(() -> service.joinBattle(1L, null, false, "n"))
                    .isInstanceOf(BattleRoomService.AlreadyInRoomException.class);
        }

        @Test
        @DisplayName("새 사용자는 join·create·join/{roomId} 모두 차단된다")
        void newPlayerBlocked() {
            assertThatThrownBy(() -> service.joinBattle(1L, null, false, "n"))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.createRoomOnly(1L, null, false, "n"))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> service.joinSpecificRoom("r1", 1L, null, false, "n"))
                    .isInstanceOf(GameDisabledException.class);
        }

        @Test
        @DisplayName("결과 화면의 준비는 다음 라운드를 열지 않고 준비 표시를 비운 뒤 오류를 알린다")
        void readyDeclined() {
            BattleRoom room = mock(BattleRoom.class);
            when(room.getStatus()).thenReturn("FINISHED");
            when(repository.findByRoomId("r1")).thenReturn(Optional.of(room));
            when(roomManager.getActivePlayers("r1")).thenReturn(List.of(
                    new BattleRoomManager.PlayerSessionInfo("p1", "n", false, null, 1L)));
            ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);

            service.handlePlayerReady("r1", "outsider");
            verify(roomManager, never()).clearReadySet(anyString());

            service.handlePlayerReady("r1", "p1");

            verify(roomManager).clearReadySet("r1");
            verify(roomManager, never()).markPlayerReady(anyString(), anyString());
            verify(roomManager, never()).fillFromQueue(anyString());
            verify(messagingTemplate).convertAndSendToUser(
                    eq("p1"), eq("/queue/blockfall-battle/errors"), any(Object.class));
        }

        @Test
        @DisplayName("켜진 게임에서 방 밖의 사용자는 준비할 수 없고 NOT_IN_ROOM 을 받는다")
        void outsiderReadyRejected() {
            when(gameStatusService.isDisabled("blockfall-battle")).thenReturn(false);
            BattleRoom room = mock(BattleRoom.class);
            when(room.getStatus()).thenReturn("FINISHED");
            when(repository.findByRoomId("r1")).thenReturn(Optional.of(room));
            when(roomManager.getActivePlayers("r1")).thenReturn(List.of(
                    new BattleRoomManager.PlayerSessionInfo("p1", "n", false, null, 1L)));
            ReflectionTestUtils.setField(service, "messagingTemplate", messagingTemplate);

            service.handlePlayerReady("r1", "outsider");

            verify(roomManager, never()).markPlayerReady(anyString(), anyString());
            verify(messagingTemplate).convertAndSendToUser(
                    eq("outsider"), eq("/queue/blockfall-battle/errors"), any(Object.class));

            service.handlePlayerReady("r1", "p1");

            verify(roomManager).markPlayerReady("r1", "p1");
        }
    }

    @Nested
    @DisplayName("야추")
    class Yacht {
        private final YachtRoomRepository roomRepository = mock(YachtRoomRepository.class);
        private final YachtGameService gameService = mock(YachtGameService.class);
        private final StringRedisTemplate redis = mock(StringRedisTemplate.class, Mockito.RETURNS_DEEP_STUBS);
        private final YachtMatchService matchService = new YachtMatchService(
                roomRepository, mock(YachtParticipantRepository.class), mock(UserRepository.class),
                gameService, mock(YachtBotService.class), redis, gameStatusService);

        @BeforeEach
        void setUp() {
            disable("yacht");
        }

        @Test
        @DisplayName("방에 있는 사용자는 꺼져도 ALREADY_IN_ROOM 으로 재접속한다")
        void reconnectSurvives() {
            when(gameService.findActiveRoomId(1L)).thenReturn(Optional.of("r1"));

            assertThatThrownBy(() -> matchService.match(1L, YachtDiceType.D6))
                    .isInstanceOf(YachtMatchService.AlreadyInRoomException.class);
            assertThatThrownBy(() -> matchService.matchBot(1L, YachtDiceType.D6))
                    .isInstanceOf(YachtMatchService.AlreadyInRoomException.class);
        }

        @Test
        @DisplayName("새 사용자는 match·match-bot·create·join 모두 차단된다")
        void newPlayerBlocked() {
            assertThatThrownBy(() -> matchService.match(1L, YachtDiceType.D6))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> matchService.matchBot(1L, YachtDiceType.D6))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> matchService.createRoom(1L, YachtDiceType.D6))
                    .isInstanceOf(GameDisabledException.class);
            assertThatThrownBy(() -> matchService.joinRoom(1L, "r1"))
                    .isInstanceOf(GameDisabledException.class);
        }

        @Test
        @DisplayName("WAITING 방의 /start 는 GAME_DISABLED 로 거절되고 방은 WAITING 그대로다")
        void startRejected() {
            YachtGameService service = new YachtGameService(
                    roomRepository, mock(YachtParticipantRepository.class), mock(YachtScoreRepository.class),
                    mock(YachtRankingService.class), mock(UserRepository.class), gameStatusService);
            YachtGameService.YachtRoomState state =
                    new YachtGameService.YachtRoomState("r1", 1L, 6, YachtDiceType.D6);
            roomsOf(service).put("r1", state);

            assertThat(service.startGame("r1", 1L)).isEqualTo(GameDisabledException.CODE);
            assertThat(state.status).isEqualTo(YachtRoomStatus.WAITING);
        }
    }

    @Nested
    @DisplayName("온라인 가위바위보")
    class Rps {
        private final RpsRoomService roomServiceMock = mock(RpsRoomService.class);
        private final RpsRoomRepository roomRepository = mock(RpsRoomRepository.class);
        private final UserRepository userRepository = mock(UserRepository.class);
        private final StringRedisTemplate redis = mock(StringRedisTemplate.class, Mockito.RETURNS_DEEP_STUBS);
        private final RpsMatchService matchService = new RpsMatchService(
                roomRepository, userRepository, roomServiceMock, redis, gameStatusService);

        private final RpsRoomService roomService = new RpsRoomService(
                roomRepository, mock(RpsPlayerStatRepository.class), taskScheduler,
                mock(RpsGameService.class), gameStatusService);

        @BeforeEach
        void setUp() {
            ReflectionTestUtils.setField(roomService, "messagingTemplate", messagingTemplate);
            when(userRepository.findById(1L)).thenReturn(Optional.of(mock(User.class)));
            disable("online-rps");
        }

        @Test
        @DisplayName("방에 있는 사용자는 꺼져도 ALREADY_IN_ROOM 으로 재접속한다")
        void reconnectSurvives() {
            when(roomServiceMock.findActiveRoomId(1L)).thenReturn(Optional.of("r1"));

            assertThatThrownBy(() -> matchService.match(1L, null))
                    .isInstanceOf(RpsMatchService.AlreadyInRoomException.class);
        }

        @Test
        @DisplayName("새 사용자의 match 는 차단된다")
        void newPlayerBlocked() {
            assertThatThrownBy(() -> matchService.match(1L, null))
                    .isInstanceOf(GameDisabledException.class);
        }

        @Test
        @DisplayName("재도전은 GAME_DISABLED 로 거절되고 카운트다운이 시작되지 않는다")
        void rematchRejected() {
            roomsOf(roomService).put("r1", twoPlayerRoom());

            assertThat(roomService.rematch("r1", 1L)).isEqualTo(GameDisabledException.CODE);
            verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
        }

        @Test
        @DisplayName("대기 방의 새 입장은 GAME_DISABLED 로 거절되고 카운트다운이 시작되지 않는다")
        void lateJoinRejected() {
            RpsRoomService.RpsRoomState state = new RpsRoomService.RpsRoomState("r1", 1L);
            state.participants.add(new RpsRoomService.RpsParticipant(1L, "a"));
            roomsOf(roomService).put("r1", state);

            assertThat(roomService.joinRoom("r1", 2L, "b")).isEqualTo(GameDisabledException.CODE);

            assertThat(state.participants).hasSize(1);
            verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
        }

        @Test
        @DisplayName("꺼진 동안 없는 방 ID로 들어와도 방이 만들어지지 않는다")
        void joinDoesNotCreateRoom() {
            assertThat(roomService.joinRoom("ghost", 1L, "a")).isEqualTo(GameDisabledException.CODE);

            assertThat(roomsOf(roomService)).isEmpty();
        }

        @Test
        @DisplayName("이미 방에 있는 사용자의 join 재발행은 꺼져도 통과한다")
        void rejoinSurvives() {
            roomsOf(roomService).put("r1", twoPlayerRoom());

            assertThat(roomService.joinRoom("r1", 1L, "a")).isNull();
            verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
        }

        @Test
        @DisplayName("켜진 게임은 두 번째 입장에서 카운트다운을 연다")
        void joinStartsCountdownWhenEnabled() {
            when(gameStatusService.isDisabled("online-rps")).thenReturn(false);
            RpsRoomService.RpsRoomState state = new RpsRoomService.RpsRoomState("r1", 1L);
            state.participants.add(new RpsRoomService.RpsParticipant(1L, "a"));
            roomsOf(roomService).put("r1", state);

            assertThat(roomService.joinRoom("r1", 2L, "b")).isNull();

            verify(taskScheduler).schedule(any(Runnable.class), any(Instant.class));
        }

        @Test
        @DisplayName("진행 중 라운드는 끝까지 처리한 뒤 GAME_DISABLED 를 알리고 방을 닫는다")
        void roundFinishesThenRoomCloses() {
            RpsRoomService.RpsRoomState state = twoPlayerRoom();
            state.status = com.dobakggun.entity.rps.RoomStatus.PLAYING;
            roomsOf(roomService).put("r1", state);

            roomService.processRoundResult("r1");

            ArgumentCaptor<Object> sent = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate, Mockito.atLeastOnce()).convertAndSend(eq("/topic/rps/room/r1"), sent.capture());
            List<RpsEnvelopeDto> envelopes = sent.getAllValues().stream().map(RpsEnvelopeDto.class::cast).toList();
            assertThat(envelopes).extracting(RpsEnvelopeDto::getType)
                    .containsExactly("ROUND_RESULT", "ROOM_STATE", "ERROR", "ROOM_CLOSED");
            assertThat(envelopes.get(2).getPayload()).isEqualTo(Map.of(
                    "code", GameDisabledException.CODE, "message", GameDisabledException.USER_MESSAGE));

            assertThat(state.status).isEqualTo(com.dobakggun.entity.rps.RoomStatus.FINISHED);
            assertThat(roomsOf(roomService)).isEmpty();
            verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
        }

        @Test
        @DisplayName("켜진 게임은 라운드가 끝나면 다음 라운드 카운트다운을 연다")
        void roundAutoRestartsWhenEnabled() {
            when(gameStatusService.isDisabled("online-rps")).thenReturn(false);
            RpsRoomService.RpsRoomState state = twoPlayerRoom();
            state.status = com.dobakggun.entity.rps.RoomStatus.PLAYING;
            roomsOf(roomService).put("r1", state);

            roomService.processRoundResult("r1");

            verify(taskScheduler).schedule(any(Runnable.class), any(Instant.class));
        }

        private RpsRoomService.RpsRoomState twoPlayerRoom() {
            RpsRoomService.RpsRoomState state = new RpsRoomService.RpsRoomState("r1", 1L);
            state.participants.addAll(List.of(
                    new RpsRoomService.RpsParticipant(1L, "a"),
                    new RpsRoomService.RpsParticipant(2L, "b")));
            return state;
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> Map<String, T> roomsOf(Object service) {
        return (ConcurrentHashMap<String, T>) ReflectionTestUtils.getField(service, "rooms");
    }
}
