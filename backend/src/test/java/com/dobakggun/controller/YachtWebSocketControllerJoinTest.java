package com.dobakggun.controller;

import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.security.ChatPrincipal;
import com.dobakggun.service.YachtGameService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 세션 속성은 ConcurrentHashMap 이라 null 값을 넣으면 입장 처리가 예외로 끝난다. */
class YachtWebSocketControllerJoinTest {

    private final YachtGameService gameService = mock(YachtGameService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final YachtWebSocketController controller = new YachtWebSocketController(gameService, userRepository);

    private Map<String, Object> joinWithProfileImage(String image) {
        User user = mock(User.class);
        when(user.getProfileImage()).thenReturn(image);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        Map<String, Object> attrs = new ConcurrentHashMap<>();
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setSessionId("s1");
        accessor.setSessionAttributes(attrs);
        assertThat(accessor.getMessageType()).isEqualTo(SimpMessageType.MESSAGE);

        controller.handleJoin("r1", accessor, new ChatPrincipal(1L, "n", "USER"));
        return accessor.getSessionAttributes();
    }

    @Test
    void 프로필_이미지가_없어도_입장_처리가_끝까지_진행된다() {
        Map<String, Object> attrs = joinWithProfileImage(null);

        assertThat(attrs).containsKey("yachtSubscribedRoomIds").doesNotContainKey("profileImageUrl");
    }

    @Test
    void 프로필_이미지가_있으면_세션에_캐시한다() {
        assertThat(joinWithProfileImage("img.png")).containsEntry("profileImageUrl", "img.png");
    }
}
