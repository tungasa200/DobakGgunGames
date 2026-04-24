package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsPlayerLeftDto {

    private String roomId;
    private Long userId;
    private String nickname;
    private String reason;
}
