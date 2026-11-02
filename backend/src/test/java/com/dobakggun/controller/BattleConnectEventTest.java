package com.dobakggun.controller;

import com.dobakggun.security.BattlePrincipal;
import com.dobakggun.service.AppleBattleRoomManager;
import com.dobakggun.service.AppleBattleRoomService;
import com.dobakggun.service.MinesweeperBattleRoomManager;
import com.dobakggun.service.MinesweeperBattleRoomService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionConnectEvent;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 배틀 세션 등록: 세션 속성은 CONNECT 프레임에만 있으므로 SessionConnectEvent 로 받는다. */
class BattleConnectEventTest {

    private final BattlePrincipal principal = new BattlePrincipal(1L, "n");

    private final AppleBattleRoomService appleService = mock(AppleBattleRoomService.class);
    private final AppleBattleWebSocketController apple = new AppleBattleWebSocketController(
            appleService, mock(AppleBattleRoomManager.class));

    private final MinesweeperBattleRoomService minesweeperService = mock(MinesweeperBattleRoomService.class);
    private final MinesweeperBattleWebSocketController minesweeper = new MinesweeperBattleWebSocketController(
            minesweeperService, mock(MinesweeperBattleRoomManager.class));

    private SessionConnectEvent connectEvent(String wsGameType) {
        Map<String, Object> attrs = new HashMap<>();
        attrs.put("isGuest", false);
        attrs.put("wsGameType", wsGameType);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("s1");
        accessor.setSessionAttributes(attrs);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new SessionConnectEvent(this, message, principal);
    }

    @Test
    @DisplayName("사과 배틀 연결은 세션을 등록한다")
    void appleRegistersSession() {
        apple.handleConnect(connectEvent("apple-battle"));

        verify(appleService).handleConnect(principal.getPlayerId(), "s1");
    }

    @Test
    @DisplayName("지뢰찾기 배틀 연결은 세션을 등록한다")
    void minesweeperRegistersSession() {
        minesweeper.handleConnect(connectEvent("minesweeper"));

        verify(minesweeperService).handleConnect(principal.getPlayerId(), "s1");
    }

    @Test
    @DisplayName("같은 /ws-battle 의 다른 게임 연결은 등록하지 않는다")
    void otherGameIgnored() {
        apple.handleConnect(connectEvent("minesweeper"));
        minesweeper.handleConnect(connectEvent("apple-battle"));

        verify(appleService, never()).handleConnect(anyString(), anyString());
        verify(minesweeperService, never()).handleConnect(anyString(), anyString());
    }
}
