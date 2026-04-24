package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class RpsRoundResultDto {

    private String roomId;
    private int roundNum;
    private List<RpsPlayerResultDto> results;
}
