package com.dobakggun.dto.chat;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ChatRoomResponse {

    private String roomId;
    private String name;
    private String creatorId;
    private String creatorNick;
    private String createdAt;
    private String lastActiveAt;
}
