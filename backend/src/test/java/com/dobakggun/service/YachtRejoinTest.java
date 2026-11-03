package com.dobakggun.service;

import com.dobakggun.dto.yacht.YachtMatchResponse;
import com.dobakggun.entity.User;
import com.dobakggun.entity.yacht.YachtDiceType;
import com.dobakggun.entity.yacht.YachtParticipant;
import com.dobakggun.entity.yacht.YachtRoom;
import com.dobakggun.entity.yacht.YachtRoomStatus;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.repository.YachtParticipantRepository;
import com.dobakggun.repository.YachtRoomRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/** 나간 참가자의 재입장. 유니크 제약과 실제 커밋이 필요해 H2로 돌린다. */
@DataJpaTest
@Import(YachtMatchService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class YachtRejoinTest {

    private static final int THREADS = 8;
    private static final String ROOM_ID = "room0001";

    @Autowired private YachtMatchService matchService;
    @Autowired private YachtRoomRepository roomRepository;
    @Autowired private YachtParticipantRepository participantRepository;
    @Autowired private UserRepository userRepository;

    @MockBean private YachtGameService gameService;
    @MockBean private YachtBotService botService;
    @MockBean private GameStatusService gameStatusService;
    @MockBean(answer = Answers.RETURNS_DEEP_STUBS) private StringRedisTemplate redis;

    private Long host;
    private Long guest;

    @BeforeEach
    void setUp() {
        when(gameService.findActiveRoomId(anyLong())).thenReturn(Optional.empty());
        when(redis.opsForValue().setIfAbsent(anyString(), anyString(), anyLong(), any())).thenReturn(true);
        host = saveUser("host");
        guest = saveUser("guest");
    }

    @AfterEach
    void cleanUp() {
        participantRepository.deleteAll();
        roomRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Long saveUser(String name) {
        return userRepository.save(User.builder().email(name + "@example.com").nickname(name).build()).getId();
    }

    /** 방장 1명이 남아 있는 방. 퇴장 때 DB 인원을 줄이지 않으므로 나간 사람이 있으면 인원은 그만큼 크다. */
    private YachtRoom saveRoom(YachtRoomStatus status, Long... leftUsers) {
        YachtRoom room = roomRepository.save(YachtRoom.builder().roomId(ROOM_ID).status(status)
                .hostUserId(host).maxPlayers(6).currentPlayers(1 + leftUsers.length)
                .diceType(YachtDiceType.D6).build());
        participantRepository.save(YachtParticipant.builder().room(room).userId(host).joinOrder(0).build());
        int order = 1;
        for (Long left : leftUsers) {
            participantRepository.save(YachtParticipant.builder().room(room).userId(left).joinOrder(order++)
                    .ready(true).leftAt(LocalDateTime.now()).build());
        }
        return room;
    }

    private YachtRoom room() {
        return roomRepository.findByRoomId(ROOM_ID).orElseThrow();
    }

    private void assertActiveInRoom(Long userId, int expectedPlayers) {
        YachtParticipant row = participantRepository.findByRoomAndUserId(room(), userId).orElseThrow();
        assertThat(row.getLeftAt()).isNull();
        assertThat(row.isReady()).isFalse();
        assertThat(participantRepository.findActiveParticipants(room())).hasSize(expectedPlayers);
        assertThat(room().getCurrentPlayers()).isEqualTo(expectedPlayers);
    }

    @Test
    void 나간_참가자가_자동매칭으로_같은_방에_돌아온다() {
        saveRoom(YachtRoomStatus.WAITING, guest);

        YachtMatchResponse response = matchService.match(guest, YachtDiceType.D6);

        assertThat(response.getRoomId()).isEqualTo(ROOM_ID);
        assertThat(response.getPlayerCount()).isEqualTo(2);
        assertActiveInRoom(guest, 2);
    }

    @Test
    void 나간_참가자가_직접_입장으로_같은_방에_돌아온다() {
        saveRoom(YachtRoomStatus.WAITING, guest);

        YachtMatchResponse response = matchService.joinRoom(guest, ROOM_ID);

        assertThat(response.getPlayerCount()).isEqualTo(2);
        assertActiveInRoom(guest, 2);
    }

    @Test
    void 나간_관전자가_진행_중인_방에_관전자로_돌아온다() {
        saveRoom(YachtRoomStatus.PLAYING, guest);

        YachtMatchResponse response = matchService.match(guest, YachtDiceType.D6);

        assertThat(response.isJoinedAsSpectator()).isTrue();
        assertActiveInRoom(guest, 2);
    }

    @Test
    void 새_참가자의_인원은_나간_사람을_세지_않는다() {
        saveRoom(YachtRoomStatus.WAITING, guest);
        Long newcomer = saveUser("new");

        assertThat(matchService.match(newcomer, YachtDiceType.D6).getPlayerCount()).isEqualTo(2);
        assertActiveInRoom(newcomer, 2);
    }

    @Test
    void 동시_재입장도_참가자는_한_명이다() throws Exception {
        saveRoom(YachtRoomStatus.WAITING, guest);

        requestConcurrently(() -> matchService.match(guest, YachtDiceType.D6));

        assertActiveInRoom(guest, 2);
    }

    @Test
    void 동시_첫_입장도_참가자는_한_명이다() throws Exception {
        saveRoom(YachtRoomStatus.WAITING);

        requestConcurrently(() -> matchService.match(guest, YachtDiceType.D6));

        assertActiveInRoom(guest, 2);
    }

    @Test
    void 대기방이_없을_때_동시_매칭도_방은_하나다() throws Exception {
        requestConcurrently(() -> matchService.match(guest, YachtDiceType.D6));

        assertThat(roomRepository.count()).isEqualTo(1);
        assertThat(participantRepository.count()).isEqualTo(1);
    }

    /** 같은 요청을 동시에 보낸다. 사용자 행 잠금으로 줄을 서므로 하나만 성공하고 나머지는 이미 방에 있음(409)이다. */
    private void requestConcurrently(Callable<YachtMatchResponse> request) throws Exception {
        CyclicBarrier start = new CyclicBarrier(THREADS);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < THREADS; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    try {
                        request.call();
                        return true;
                    } catch (YachtMatchService.AlreadyInRoomException alreadyIn) {
                        return false;
                    }
                }));
            }
            int success = 0;
            for (Future<Boolean> result : results) {
                if (result.get(30, TimeUnit.SECONDS)) success++;
            }
            assertThat(success).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }
}
