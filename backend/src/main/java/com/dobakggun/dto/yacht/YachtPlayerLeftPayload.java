package com.dobakggun.dto.yacht;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class YachtPlayerLeftPayload {

    private String roomId;
    private Long userId;
    private String nickname;
    /** "LEAVE" 또는 "DISCONNECT" */
    private String reason;
}
