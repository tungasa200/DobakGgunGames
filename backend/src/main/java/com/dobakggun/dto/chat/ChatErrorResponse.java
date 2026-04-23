package com.dobakggun.dto.chat;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ChatErrorResponse {

    private String code;
    private String message;
}
