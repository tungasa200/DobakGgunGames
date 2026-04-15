package com.dobakggun.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class MinesweeperSessionStartRequest {

    @NotBlank
    @Size(max = 20)
    private String level;

    /** 첫 클릭 행 (서버 보드 생성 시 first-click-safe 보장용) */
    private Integer firstClickR;

    /** 첫 클릭 열 */
    private Integer firstClickC;
}
