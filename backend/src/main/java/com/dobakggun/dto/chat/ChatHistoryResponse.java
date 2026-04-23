package com.dobakggun.dto.chat;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ChatHistoryResponse {

    private String roomId;
    private String roomName;
    private List<ChatMessageResponse> messages;
    private boolean degraded;
}
