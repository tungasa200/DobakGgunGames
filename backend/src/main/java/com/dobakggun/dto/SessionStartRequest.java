package com.dobakggun.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SessionStartRequest {

    @NotBlank
    @Size(max = 20)
    private String level;

    /** 사과게임 large 모드 전용 — portrait(세로) 여부, 생략 시 false */
    private Boolean portrait;
}
