package com.dobakggun.dto.rsp;

import com.dobakggun.entity.RspChoice;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RspPlayRequest {

    @NotNull(message = "userChoice는 필수입니다")
    private RspChoice userChoice;
}
