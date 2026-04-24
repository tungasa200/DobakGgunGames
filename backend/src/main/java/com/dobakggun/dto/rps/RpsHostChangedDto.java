package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsHostChangedDto {

    private String roomId;
    private Long newHostUserId;
    private String newHostNickname;
}
