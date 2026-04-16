package com.dobakggun.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class TokenRefreshRequest {

    @NotBlank
    private String refreshToken;
}
