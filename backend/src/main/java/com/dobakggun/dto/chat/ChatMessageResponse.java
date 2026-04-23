package com.dobakggun.dto.chat;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ChatMessageResponse {

    private String type;
    private Long userId;
    private String nickname;
    private String message;
    private String timestamp;
}
