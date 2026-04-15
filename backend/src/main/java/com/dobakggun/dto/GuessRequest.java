package com.dobakggun.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class GuessRequest {

    @NotBlank
    private String sessionId;

    @NotBlank
    private String guess;
}
