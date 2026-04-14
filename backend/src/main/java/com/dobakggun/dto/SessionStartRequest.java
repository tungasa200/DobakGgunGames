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
}
