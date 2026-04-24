package com.dobakggun.dto.rps;

import com.dobakggun.entity.rps.RpsChoice;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RpsChooseRequest {

    @NotNull(message = "choice는 필수입니다.")
    private RpsChoice choice;
}
