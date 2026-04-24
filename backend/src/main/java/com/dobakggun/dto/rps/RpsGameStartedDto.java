package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class RpsGameStartedDto {

    private String roomId;
    private int roundNum;
    private String deadlineAt;
    private int timeoutSeconds;
    private List<Long> participantUserIds;
}
