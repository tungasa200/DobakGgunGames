package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsMatchCountdownDto {

    private String roomId;
    private Integer secondsRemaining;
    private String startAt;
    private String reason;
}
