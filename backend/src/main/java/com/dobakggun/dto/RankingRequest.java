package com.dobakggun.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class RankingRequest {

    @NotBlank
    @Size(max = 20)
    private String level;

    @NotBlank
    @Size(max = 50)
    private String name;

    // 게임별로 해당하는 필드만 사용
    private Double time;
    private Integer score;
    private Integer attempts;
    private Integer moves;
    private Integer gameLevel;

    @NotBlank
    private String token;  // HMAC 검증 토큰

    private Long timestamp;  // Unix timestamp (초)
}
