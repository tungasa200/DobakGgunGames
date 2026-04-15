package com.dobakggun.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SolitaireMovesBatchRequest {

    @NotBlank
    private String sessionId;

    @Min(1)
    private int count;  // 이번 배치에서 발생한 이동 수
}
