package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtChatPayload {
    private Long userId;
    private String nickname;
    private String profileImageUrl;
    private String message;
}
