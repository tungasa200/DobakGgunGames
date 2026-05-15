package com.dobakggun.dto.rps;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RpsPlayerResultDto {

    private Long userId;
    private String nickname;
    private String choice;
    private boolean autoPicked;
    private String result;
    private Double winRate;
}
