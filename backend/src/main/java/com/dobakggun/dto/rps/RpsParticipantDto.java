package com.dobakggun.dto.rps;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsParticipantDto {

    private Long userId;
    private String nickname;

    @JsonProperty("isHost")
    private boolean isHost;
}
