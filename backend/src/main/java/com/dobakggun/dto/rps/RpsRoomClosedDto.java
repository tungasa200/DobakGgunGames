package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsRoomClosedDto {

    private String roomId;
    private String reason;
}
