package com.dobakggun.dto.chat;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ChatRoomListResponse {

    private List<ChatRoomResponse> rooms;
    private boolean degraded;
}
